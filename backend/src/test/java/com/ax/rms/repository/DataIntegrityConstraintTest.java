package com.ax.rms.repository;

import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.ax.rms.support.AbstractDatabaseTest;
import java.sql.Connection;
import java.sql.SQLException;
import java.sql.Statement;
import javax.sql.DataSource;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

class DataIntegrityConstraintTest extends AbstractDatabaseTest {

  @Autowired private DataSource dataSource;

  @BeforeEach
  void seedParents() throws SQLException {
    try (Connection connection = dataSource.getConnection();
        Statement statement = connection.createStatement()) {
      // 이 테스트 클래스의 모든 메서드가 같은(클래스당 하나의) 임시 DB를 공유하므로, 매번 비우고 시작한다.
      for (String table :
          new String[] {
            "assignment",
            "employee_skill",
            "account_role",
            "account",
            "project_required_skill_line",
            "project",
            "employee",
            "department"
          }) {
        statement.execute("delete from " + table);
      }
      statement.execute("insert into department(id, name) values (1, '개발팀')");
      statement.execute(
          "insert into employee(id, name, department_id, job_title, career_years, "
              + "availability_status) values (1, '테스트', 1, '개발자', 3, 'AVAILABLE')");
      statement.execute(
          "insert into project(id, name, description, start_date, end_date, status) "
              + "values (1, '테스트 프로젝트', '', '2026-01-01', '2026-12-31', 'IN_PROGRESS')");
    }
  }

  @Test
  void rejectsOutOfRangeOrNonMultipleAllocationPercent() {
    assertThatThrownBy(
            () ->
                insert(
                    "insert into assignment(employee_id, project_id, start_date, end_date, "
                        + "allocation_percent) values (1, 1, '2026-01-01', '2026-02-01', 7)"))
        .isInstanceOf(SQLException.class);
  }

  @Test
  void rejectsInvalidAvailabilityStatus() {
    assertThatThrownBy(
            () ->
                insert(
                    "insert into employee(name, department_id, job_title, career_years, "
                        + "availability_status) values ('다른직원', 1, '개발자', 1, 'NOT_A_STATUS')"))
        .isInstanceOf(SQLException.class);
  }

  @Test
  void rejectsInvalidProficiencyLevelAndProjectStatus() {
    assertThatThrownBy(
            () ->
                insert(
                    "insert into employee_skill(employee_id, skill_name, proficiency_level) "
                        + "values (1, 'Java', 'EXPERT')"))
        .isInstanceOf(SQLException.class);
    assertThatThrownBy(
            () ->
                insert(
                    "insert into project(name, description, start_date, end_date, status) "
                        + "values ('다른 프로젝트', '', '2026-01-01', '2026-12-31', 'CANCELLED')"))
        .isInstanceOf(SQLException.class);
  }

  @Test
  void rejectsDuplicateAccountForTheSameEmployee() {
    assertThatThrownBy(
            () -> {
              insert("insert into account(employee_id, username, password_hash) "
                  + "values (1, 'user1', 'hash1')");
              insert("insert into account(employee_id, username, password_hash) "
                  + "values (1, 'user2', 'hash2')");
            })
        .isInstanceOf(SQLException.class);
  }

  private void insert(String sql) throws SQLException {
    try (Connection connection = dataSource.getConnection();
        Statement statement = connection.createStatement()) {
      statement.execute(sql);
    }
  }
}
