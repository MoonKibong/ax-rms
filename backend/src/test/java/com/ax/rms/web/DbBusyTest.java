package com.ax.rms.web;

import static com.ax.rms.support.ErrorAssertions.assertError;
import static org.assertj.core.api.Assertions.assertThat;

import ch.qos.logback.classic.Level;
import com.ax.rms.repository.DepartmentRepository;
import com.ax.rms.repository.EmployeeRepository;
import com.ax.rms.support.AbstractApiTest;
import com.ax.rms.support.ApiClient;
import com.ax.rms.support.ApiClient.Response;
import com.ax.rms.support.LogCapture;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;
import java.sql.Statement;
import javax.sql.DataSource;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/** T#56 기준 6: 다른 연결이 쓰기 잠금을 잡고 있으면 쓰기 요청은 409 {@code DB_BUSY}다. */
class DbBusyTest extends AbstractApiTest {

  @Autowired private DataSource dataSource;
  @Autowired private DepartmentRepository departmentRepository;
  @Autowired private EmployeeRepository employeeRepository;

  @Test
  void writeWhileAnotherConnectionHoldsTheLockIsConflict() throws SQLException {
    ApiClient hr = client();
    hr.login("hr.manager", "HrManager!1");
    long departmentId = departmentRepository.findAll().get(0).id();
    String body =
        "{\"name\":\"잠금직원\",\"departmentId\":" + departmentId
            + ",\"jobTitle\":\"백엔드 개발자\",\"careerYears\":1,\"skills\":[]}";
    int before = employeeRepository.findAll().size();

    String url;
    try (Connection probe = dataSource.getConnection()) {
      url = probe.getMetaData().getURL();
    }
    try (Connection locker = DriverManager.getConnection(url);
        Statement statement = locker.createStatement();
        LogCapture logs = new LogCapture()) {
      statement.execute("BEGIN IMMEDIATE");
      Response busy;
      try {
        busy = hr.sendJson("POST", "/api/employees", body);
      } finally {
        statement.execute("ROLLBACK");
      }

      assertError(busy, 409, "DB_BUSY");
      assertThat(logs.exactly(Level.WARN)).as("WARN 로그").isNotEmpty();
    }
    assertThat(employeeRepository.findAll()).as("만들어지지 않았다").hasSize(before);
    assertThat(hr.sendJson("POST", "/api/employees", body).status()).isEqualTo(201);
  }
}
