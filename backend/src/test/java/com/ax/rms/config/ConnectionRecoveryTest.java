package com.ax.rms.config;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.ax.rms.support.AbstractDatabaseTest;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.Statement;
import javax.sql.DataSource;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * BUSY로 트랜잭션 시작(`doBegin`)이 실패한 뒤, 그 커넥션이 풀에서 재사용돼도 다음 트랜잭션은 안전해야 한다
 * (T#54 기준 7, "사실 정정" 대응 — B#2). 풀 크기를 1로 고정해, BUSY를 겪은 그 물리 커넥션이 다음 트랜잭션에
 * 반드시 재사용되도록 한다(풀 크기가 크면 다른 유휴 커넥션이 먼저 나가 재현되지 않을 수 있다 — 직접 확인함).
 */
class ConnectionRecoveryTest extends AbstractDatabaseTest {

  @DynamicPropertySource
  static void onlyOneConnection(DynamicPropertyRegistry registry) {
    registry.add("spring.datasource.hikari.maximum-pool-size", () -> 1);
  }

  @Autowired private DataSource dataSource;
  @Autowired private PlatformTransactionManager transactionManager;
  @Autowired private JdbcTemplate jdbcTemplate;

  @Test
  void requestAfterBusyBeginStillSucceeds() throws Exception {
    TransactionTemplate tx = new TransactionTemplate(transactionManager);

    String url;
    try (Connection probe = dataSource.getConnection()) {
      url = probe.getMetaData().getURL();
    }

    try (Connection locker = DriverManager.getConnection(url);
        Statement lockerStatement = locker.createStatement()) {
      lockerStatement.execute("BEGIN IMMEDIATE");

      assertThatThrownBy(
              () ->
                  tx.executeWithoutResult(
                      status ->
                          jdbcTemplate.update(
                              "insert into department(name) values ('T54복구실패')")))
          .isInstanceOf(Exception.class);

      lockerStatement.execute("ROLLBACK");
    }

    tx.executeWithoutResult(
        status -> jdbcTemplate.update("insert into department(name) values ('T54복구성공')"));

    assertThat(
            jdbcTemplate.queryForObject(
                "select count(*) from department where name = 'T54복구성공'", Integer.class))
        .isEqualTo(1);
  }
}
