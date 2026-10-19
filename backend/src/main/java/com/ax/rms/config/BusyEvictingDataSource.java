package com.ax.rms.config;

import com.zaxxer.hikari.HikariDataSource;
import java.lang.reflect.InvocationHandler;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.lang.reflect.Proxy;
import java.sql.Connection;
import java.sql.SQLException;
import org.springframework.jdbc.datasource.DelegatingDataSource;

/**
 * {@code setAutoCommit(false)}가 SQLite BUSY로 실패하면 그 커넥션을 풀에서 버린다(T#54 기준 7).
 *
 * <p>{@code org.xerial:sqlite-jdbc}는 {@code BEGIN IMMEDIATE}가 BUSY로 실패해도 커넥션 내부의
 * {@code autoCommit} 플래그를 이미 {@code false}로 갱신해 버린다(직접 확인함,
 * {@code docs/evidence/T54.md}). 그 물리 커넥션이 풀에서 재사용되면 다음 트랜잭션은 "이미 시작됨"으로
 * 보여 실제 {@code BEGIN}이 다시 나가지 않고, 그 상태에서 실행한 쓰기는 자동커밋으로 끝나 뒤이은
 * {@code commit()}이 "커밋할 트랜잭션이 없다"며 실패한다.
 *
 * <p>{@link org.springframework.jdbc.datasource.DataSourceTransactionManager#doBegin}은 실패하면 그
 * 커넥션을 스스로 반납하고 홀더를 지워 버려, {@code PlatformTransactionManager}를 상속해 그 시점에
 * 커넥션을 집으려 해도 이미 늦다(직접 확인함) — 그래서 이 클래스는 더 이른 지점, 커넥션 자체의
 * {@code setAutoCommit}을 가로채 실패 즉시 {@link HikariDataSource#evictConnection}으로 버린다.
 */
public class BusyEvictingDataSource extends DelegatingDataSource {

  private final HikariDataSource hikariDataSource;

  /** 실제 커넥션 풀을 감싸 쓴다. */
  public BusyEvictingDataSource(HikariDataSource hikariDataSource) {
    super(hikariDataSource);
    this.hikariDataSource = hikariDataSource;
  }

  @Override
  public Connection getConnection() throws SQLException {
    return wrap(super.getConnection());
  }

  private Connection wrap(Connection real) {
    return (Connection)
        Proxy.newProxyInstance(
            Connection.class.getClassLoader(),
            new Class<?>[] {Connection.class},
            new EvictOnFailedBeginHandler(real));
  }

  private final class EvictOnFailedBeginHandler implements InvocationHandler {
    private final Connection real;

    EvictOnFailedBeginHandler(Connection real) {
      this.real = real;
    }

    @Override
    public Object invoke(Object proxy, Method method, Object[] args) throws Throwable {
      try {
        return method.invoke(real, args);
      } catch (InvocationTargetException invocationTargetException) {
        Throwable cause = invocationTargetException.getCause();
        if (isFailedBegin(method, args, cause)) {
          hikariDataSource.evictConnection(real);
        }
        throw cause;
      }
    }

    private boolean isFailedBegin(Method method, Object[] args, Throwable cause) {
      return "setAutoCommit".equals(method.getName())
          && args != null
          && args.length == 1
          && Boolean.FALSE.equals(args[0])
          && cause instanceof SQLException;
    }
  }
}
