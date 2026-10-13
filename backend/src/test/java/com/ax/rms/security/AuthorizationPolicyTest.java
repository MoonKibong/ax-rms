package com.ax.rms.security;

import static com.ax.rms.security.AuthorizationPolicyTest.Expect.ALLOWED;
import static com.ax.rms.security.AuthorizationPolicyTest.Expect.FORBIDDEN;
import static com.ax.rms.security.AuthorizationPolicyTest.Expect.UNAUTHORIZED;
import static org.assertj.core.api.Assertions.assertThat;

import com.ax.rms.repository.AccountRepository;
import com.ax.rms.support.AbstractApiTest;
import com.ax.rms.support.ApiClient;
import com.ax.rms.support.ApiClient.Response;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Stream;
import org.junit.jupiter.api.DynamicTest;
import org.junit.jupiter.api.TestFactory;
import org.springframework.beans.factory.annotation.Autowired;

/**
 * T#6 기준 5·6: 계약서 "권한 정책" 표를 행마다 그대로 옮겨, 비로그인과 데모 계정 4개가 각 요청에서 받는 응답을 본다.
 * 기대값은 역할 규칙에서 계산하지 않고 표의 값을 그대로 적는다. "허용"은 인증·권한 단계가 막지 않는다는 뜻이므로
 * 401도 403도 아님을 본다(처리기가 아직 없는 경로는 404·405).
 */
class AuthorizationPolicyTest extends AbstractApiTest {

  /** 표의 칸 하나. */
  enum Expect {
    UNAUTHORIZED,
    FORBIDDEN,
    ALLOWED
  }

  private static final String NONE = "비로그인";
  private static final List<String> SUBJECTS =
      List.of(NONE, "employee.demo", "hr.manager", "project.manager", "dual.manager");
  private static final Map<String, String> PASSWORDS =
      Map.of(
          "employee.demo", "Employee!1",
          "hr.manager", "HrManager!1",
          "project.manager", "ProjectManager!1",
          "dual.manager", "DualManager!1");

  // 열 순서: 비로그인, 직원만, 인력 관리자, 프로젝트 관리자, 겸임 (계약서 표와 같다).
  private static final List<Row> TABLE =
      List.of(
          row("GET", "/api/health", ALLOWED, ALLOWED, ALLOWED, ALLOWED, ALLOWED),
          row("GET", "/api/auth/me", UNAUTHORIZED, ALLOWED, ALLOWED, ALLOWED, ALLOWED),
          row("GET", "/api/me/employee", UNAUTHORIZED, ALLOWED, ALLOWED, ALLOWED, ALLOWED),
          row("GET", "/api/employees", UNAUTHORIZED, FORBIDDEN, ALLOWED, ALLOWED, ALLOWED),
          row(
              "GET",
              "/api/employees?departmentId=1",
              UNAUTHORIZED, FORBIDDEN, ALLOWED, ALLOWED, ALLOWED),
          row("GET", "/api/employees/{other}", UNAUTHORIZED, FORBIDDEN, ALLOWED, ALLOWED, ALLOWED),
          row("GET", "/api/employees/{own}", UNAUTHORIZED, FORBIDDEN, ALLOWED, ALLOWED, ALLOWED),
          row("POST", "/api/employees", UNAUTHORIZED, FORBIDDEN, ALLOWED, FORBIDDEN, ALLOWED),
          row(
              "PATCH",
              "/api/employees/{other}/status",
              UNAUTHORIZED, FORBIDDEN, ALLOWED, FORBIDDEN, ALLOWED),
          row("GET", "/api/projects", UNAUTHORIZED, FORBIDDEN, ALLOWED, ALLOWED, ALLOWED),
          row("POST", "/api/projects", UNAUTHORIZED, FORBIDDEN, FORBIDDEN, ALLOWED, ALLOWED),
          row("PUT", "/api/projects/1", UNAUTHORIZED, FORBIDDEN, FORBIDDEN, ALLOWED, ALLOWED),
          row("GET", "/api/assignments", UNAUTHORIZED, FORBIDDEN, ALLOWED, ALLOWED, ALLOWED),
          row("POST", "/api/assignments", UNAUTHORIZED, FORBIDDEN, FORBIDDEN, ALLOWED, ALLOWED),
          row("DELETE", "/api/assignments/1", UNAUTHORIZED, FORBIDDEN, FORBIDDEN, ALLOWED, ALLOWED),
          row("GET", "/api/dashboard", UNAUTHORIZED, FORBIDDEN, ALLOWED, ALLOWED, ALLOWED),
          row("POST", "/api/dashboard", UNAUTHORIZED, FORBIDDEN, FORBIDDEN, FORBIDDEN, FORBIDDEN),
          row("PUT", "/api/me/employee", UNAUTHORIZED, FORBIDDEN, FORBIDDEN, FORBIDDEN, FORBIDDEN),
          row("GET", "/api/unknown", UNAUTHORIZED, FORBIDDEN, FORBIDDEN, FORBIDDEN, FORBIDDEN));

  @Autowired private AccountRepository accountRepository;

  private final Map<String, ApiClient> sessions = new HashMap<>();

  @TestFactory
  Stream<DynamicTest> loggedOutRequestsFollowThePolicyTable() {
    return cases(List.of(NONE));
  }

  @TestFactory
  Stream<DynamicTest> accountRequestsFollowThePolicyTable() {
    return cases(SUBJECTS.subList(1, SUBJECTS.size()));
  }

  @TestFactory
  Stream<DynamicTest> rewrittenAddressesDoNotOpenEmployeesToAnEmployeeOnlyAccount() {
    return Stream.of("/API/employees", "/api//employees")
        .map(
            path ->
                DynamicTest.dynamicTest(
                    "employee.demo GET " + path + " → 2xx 아님",
                    () -> {
                      Response response = session("employee.demo").get(path);
                      assertThat(response.status() / 100)
                          .as("상태 %d", response.status())
                          .isNotEqualTo(2);
                    }));
  }

  @TestFactory
  Stream<DynamicTest> loggedOutLogoutIsUnauthorizedAndHealthStaysUp() {
    return Stream.of(
        DynamicTest.dynamicTest(
            "비로그인 POST /api/auth/logout → 401",
            () -> expect(client().send("POST", "/api/auth/logout", null, null), UNAUTHORIZED)),
        DynamicTest.dynamicTest(
            "비로그인 GET /api/health → 200 UP",
            () -> {
              Response response = client().get("/api/health");
              assertThat(response.status()).isEqualTo(200);
              assertThat(response.json().path("status").asText()).isEqualTo("UP");
            }));
  }

  private Stream<DynamicTest> cases(List<String> subjects) {
    List<DynamicTest> tests = new ArrayList<>();
    for (String subject : subjects) {
      int column = SUBJECTS.indexOf(subject);
      for (Row row : TABLE) {
        Expect expected = row.expected().get(column);
        tests.add(
            DynamicTest.dynamicTest(
                subject + " " + row.method() + " " + row.path() + " → " + expected,
                () -> {
                  ApiClient client = NONE.equals(subject) ? client() : session(subject);
                  String path = resolve(row.path(), subject);
                  String body = "GET".equals(row.method()) ? null : "{}";
                  expect(client.sendJson(row.method(), path, body), expected);
                }));
      }
    }
    return tests.stream();
  }

  private void expect(Response response, Expect expected) {
    switch (expected) {
      case UNAUTHORIZED -> {
        assertThat(response.status()).as("상태").isEqualTo(401);
        assertThat(response.json().path("code").asText()).isEqualTo("AUTH_REQUIRED");
      }
      case FORBIDDEN -> {
        assertThat(response.status()).as("상태").isEqualTo(403);
        assertThat(response.json().path("code").asText()).isEqualTo("AUTH_FORBIDDEN");
      }
      default -> assertThat(response.status()).as("상태").isNotIn(401, 403);
    }
  }

  /** {@code {own}}은 그 계정의 직원 ID, {@code {other}}는 다른 데모 계정의 직원 ID로 바꾼다. */
  private String resolve(String path, String subject) {
    String own = NONE.equals(subject) ? "employee.demo" : subject;
    String other = "hr.manager".equals(own) ? "employee.demo" : "hr.manager";
    return path.replace("{own}", String.valueOf(employeeIdOf(own)))
        .replace("{other}", String.valueOf(employeeIdOf(other)));
  }

  private long employeeIdOf(String username) {
    return accountRepository.findByUsername(username).orElseThrow().employeeId();
  }

  private ApiClient session(String username) {
    return sessions.computeIfAbsent(
        username,
        name -> {
          ApiClient client = client();
          Response login = client.login(name, PASSWORDS.get(name));
          if (login.status() != 200) {
            throw new IllegalStateException(name + " 로그인 실패(준비 단계): 상태 " + login.status());
          }
          return client;
        });
  }

  private static Row row(String method, String path, Expect... expected) {
    return new Row(method, path, List.of(expected));
  }

  private record Row(String method, String path, List<Expect> expected) {}
}
