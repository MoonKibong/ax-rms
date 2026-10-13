package com.ax.rms;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.File;
import java.sql.Connection;
import java.sql.Statement;
import javax.sql.DataSource;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.SpringBootTest.WebEnvironment;

@SpringBootTest(webEnvironment = WebEnvironment.NONE)
class ApplicationStartupTest {

  private static final String JDBC_SQLITE_PREFIX = "jdbc:sqlite:";

  @Autowired
  private DataSource dataSource;

  @Value("${spring.datasource.url}")
  private String datasourceUrl;

  @Test
  void createsTheConfiguredSqliteFile() throws Exception {
    try (Connection connection = dataSource.getConnection();
        Statement statement = connection.createStatement()) {
      statement.execute("select 1");
    }

    String pathAndQuery = datasourceUrl.substring(JDBC_SQLITE_PREFIX.length());
    String path = pathAndQuery.split("\\?", 2)[0];
    assertThat(new File(path)).exists();
  }
}
