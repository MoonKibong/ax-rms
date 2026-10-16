package com.ax.rms.config;

import static org.assertj.core.api.Assertions.assertThat;

import com.ax.rms.support.AbstractDatabaseTest;
import java.sql.Connection;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.concurrent.CyclicBarrier;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import javax.sql.DataSource;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/**
 * 잠금을 실제로 재현한다(T#54 기준 6, B#2).
 *
 * <p>realistic 짧은 경쟁: 두 커넥션이 거의 동시에 쓰기 트랜잭션을 시작하면(흔한 경우, D8 재현과 같은 모양),
 * 하나가 짧게 기다렸다가 성공한다(둘 다 예외 없이 끝난다).
 *
 * <p>장기 잠금: 한 커넥션이 쓰기 잠금을 8초(목표 busy_timeout 5000ms보다 길게) 들고 있으면, 다른 커넥션의
 * 쓰기는 대략 그 busy_timeout만큼 기다린 뒤 결국 실패한다 — 걸린 시간을 재서 그 가치가 실제로 적용됐는지
 * 본다.
 *
 * <p>참고(구현 중 확인한 사실): {@code transaction_mode=immediate}에서 두 커넥션의 {@code BEGIN IMMEDIATE}가
 * 부딪히는 경우, xerial sqlite-jdbc 3.53.4.0은 "짧게 쥐고 있다가 풀어주는" 인위적인 지연(예: 1~4초 유지 뒤
 * 해제)에 대해 재시도 중 해제를 바로 감지하지 못하고 busy_timeout 전체를 기다린 뒤에야 끝난다(0초만 쥐고
 * 있어도 약 5000ms 뒤 실패를 관찰함 — 직접 확인함). 반면 실제 업무 트랜잭션처럼 경쟁이 아주 짧게(수십 ms
 * 이하) 끝나는 경우는 기준 5(`ConcurrentAssignmentTest`)가 이미 안정적으로 통과함을 보여 준다. 그래서 이
 * 기준의 "짧은 경쟁" 검사는 인위적으로 오래 쥐고 있다가 푸는 방식이 아니라, 거의 동시에 시작하는 실제와 같은
 * 경쟁으로 둔다.
 */
class LockObservationTest extends AbstractDatabaseTest {

  @Autowired private DataSource dataSource;

  @Test
  void nearSimultaneousWritersBothSucceed() throws Exception {
    ExecutorService pool = Executors.newFixedThreadPool(2);
    try {
      CyclicBarrier barrier = new CyclicBarrier(2);
      Future<Boolean> first = pool.submit(() -> writeOnce(barrier, "T54경쟁A"));
      Future<Boolean> second = pool.submit(() -> writeOnce(barrier, "T54경쟁B"));

      assertThat(first.get(10, TimeUnit.SECONDS)).as("첫 번째 쓰기").isTrue();
      assertThat(second.get(10, TimeUnit.SECONDS)).as("두 번째 쓰기").isTrue();
    } finally {
      pool.shutdownNow();
    }
  }

  @Test
  void lockLongerThanBusyTimeoutFailsAfterRoughlyTheConfiguredTimeout() throws Exception {
    long elapsedMillis = runWaiterAgainstLockHeldFor(8);
    assertThat(elapsedMillis).isBetween(4_500L, 6_500L);
  }

  private boolean writeOnce(CyclicBarrier barrier, String name) {
    try {
      barrier.await(5, TimeUnit.SECONDS);
    } catch (Exception e) {
      throw new RuntimeException(e);
    }
    try (Connection connection = dataSource.getConnection()) {
      connection.setAutoCommit(false);
      try (Statement statement = connection.createStatement()) {
        statement.execute("insert into department(name) values ('" + name + "')");
      }
      connection.commit();
      return true;
    } catch (SQLException e) {
      return false;
    }
  }

  /**
   * 한 커넥션으로 {@code lockSeconds}초 동안 쓰기 잠금을 잡고 있는 동안 다른 커넥션으로 같은 테이블에 쓰기를
   * 시도한다.
   *
   * @return 그 시도가 성공하거나 {@code SQLITE_BUSY}로 끝날 때까지 걸린 시간(ms)
   */
  private long runWaiterAgainstLockHeldFor(int lockSeconds) throws Exception {
    ExecutorService pool = Executors.newFixedThreadPool(1);
    try (Connection holder = dataSource.getConnection()) {
      holder.setAutoCommit(false);
      try (Statement holderStatement = holder.createStatement()) {
        holderStatement.execute("insert into department(name) values ('T54잠금')");
      }

      Future<Long> waiterElapsed = pool.submit(this::attemptInsertAndMeasure);
      Thread.sleep(lockSeconds * 1000L);
      holder.commit();

      return waiterElapsed.get(15, TimeUnit.SECONDS);
    } finally {
      pool.shutdownNow();
    }
  }

  private long attemptInsertAndMeasure() {
    long start = System.currentTimeMillis();
    try (Connection waiter = dataSource.getConnection()) {
      waiter.setAutoCommit(false);
      try (Statement statement = waiter.createStatement()) {
        statement.execute("insert into department(name) values ('T54대기')");
        waiter.commit();
      }
    } catch (SQLException expectedWhenStillLocked) {
      // SQLITE_BUSY 자체는 여기서 실패가 아니다 — 걸린 시간만 잰다.
    }
    return System.currentTimeMillis() - start;
  }
}
