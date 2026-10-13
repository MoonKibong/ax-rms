package com.ax.rms.repository;

import static org.assertj.core.api.Assertions.assertThat;

import com.ax.rms.support.AbstractDatabaseTest;
import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.List;
import javax.sql.DataSource;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

class SchemaTest extends AbstractDatabaseTest {

  private static final List<String> EXPECTED_TABLES =
      List.of(
          "department",
          "employee",
          "employee_skill",
          "account",
          "account_role",
          "project",
          "project_required_skill_line",
          "assignment");

  @Autowired private DataSource dataSource;

  @Test
  void createsAllEightTables() throws Exception {
    List<String> tableNames = new ArrayList<>();
    try (Connection connection = dataSource.getConnection();
        Statement statement = connection.createStatement();
        ResultSet rs =
            statement.executeQuery("select name from sqlite_master where type = 'table'")) {
      while (rs.next()) {
        tableNames.add(rs.getString("name"));
      }
    }
    assertThat(tableNames).containsAll(EXPECTED_TABLES);
  }
}
