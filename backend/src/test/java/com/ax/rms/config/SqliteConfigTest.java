package com.ax.rms.config;

import static org.assertj.core.api.Assertions.assertThat;

import com.ax.rms.support.AbstractDatabaseTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;

/** SQLite 연결의 WAL·busy_timeout 설정을 검사한다(T#54, B#2). */
class SqliteConfigTest extends AbstractDatabaseTest {

  @Autowired private JdbcTemplate jdbcTemplate;

  @Test
  void journalModeIsWal() {
    String mode = jdbcTemplate.queryForObject("PRAGMA journal_mode", String.class);
    assertThat(mode).isEqualToIgnoringCase("wal");
  }

  @Test
  void busyTimeoutIs5000() {
    Integer timeout = jdbcTemplate.queryForObject("PRAGMA busy_timeout", Integer.class);
    assertThat(timeout).isEqualTo(5000);
  }
}
