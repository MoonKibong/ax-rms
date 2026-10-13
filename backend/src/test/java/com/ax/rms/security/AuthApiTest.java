package com.ax.rms.security;

import static org.assertj.core.api.Assertions.assertThat;

import com.ax.rms.repository.AccountRepository;
import com.ax.rms.support.AbstractApiTest;
import com.ax.rms.support.ApiClient;
import com.ax.rms.support.ApiClient.Response;
import com.fasterxml.jackson.databind.JsonNode;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/**
 * T#6 기준 1–4: 로그인·me·로그아웃 API와 세션. 데모 계정 값은 T#6 계약서의 "데모 계정" 표(T#5 시드)다. 직원 ID는 시드
 * 순서로 정해지므로 숫자를 적지 않고 저장소에서 찾는다.
 */
class AuthApiTest extends AbstractApiTest {

  private static final List<DemoAccount> ACCOUNTS =
      List.of(
          new DemoAccount("hr.manager", "HrManager!1", "이수민", Set.of("EMPLOYEE", "HR_MANAGER")),
          new DemoAccount(
              "project.manager", "ProjectManager!1", "정하늘", Set.of("EMPLOYEE", "PROJECT_MANAGER")),
          new DemoAccount("employee.demo", "Employee!1", "한지우", Set.of("EMPLOYEE")),
          new DemoAccount(
              "dual.manager",
              "DualManager!1",
              "오승현",
              Set.of("EMPLOYEE", "HR_MANAGER", "PROJECT_MANAGER")));

  private static final String INVALID_CREDENTIALS_MESSAGE = "계정 또는 비밀번호가 올바르지 않습니다.";

  @Autowired private AccountRepository accountRepository;

  @Test
  void everyDemoAccountLogsInWithItsEmployeeAndRoles() {
    for (DemoAccount account : ACCOUNTS) {
      Response response = client().login(account.username(), account.password());

      assertThat(response.status()).as("%s 로그인 상태", account.username()).isEqualTo(200);
      expectAccountBody(response, account);
    }
  }

  @Test
  void wrongPasswordAndUnknownAccountGetTheSameAnswer() {
    Response wrongPassword = client().login("hr.manager", "wrong-password");
    Response unknownAccount = client().login("no.such.account", "HrManager!1");

    for (Response response : List.of(wrongPassword, unknownAccount)) {
      assertThat(response.status()).isEqualTo(401);
      assertThat(response.json().path("code").asText()).isEqualTo("AUTH_INVALID_CREDENTIALS");
      assertThat(response.json().path("message").asText()).isEqualTo(INVALID_CREDENTIALS_MESSAGE);
    }
    assertThat(unknownAccount.body()).isEqualTo(wrongPassword.body());
  }

  @Test
  void blankOrMissingFieldsAreBadRequests() {
    List<String> bodies =
        List.of(
            "{\"username\":\"\",\"password\":\"HrManager!1\"}",
            "{\"username\":\"hr.manager\",\"password\":\"  \"}",
            "{\"username\":\"hr.manager\"}",
            "{}");
    for (String body : bodies) {
      Response response = client().sendJson("POST", "/api/auth/login", body);

      assertThat(response.status()).as("본문 %s", body).isEqualTo(400);
      assertThat(response.json().path("code").asText()).isEqualTo("AUTH_INVALID_REQUEST");
      assertThat(response.json().path("message").asText()).isEqualTo("계정과 비밀번호를 입력하세요.");
    }
  }

  @Test
  void formLoginIsRejected() {
    Response response =
        client()
            .send(
                "POST",
                "/api/auth/login",
                "application/x-www-form-urlencoded",
                "username=hr.manager&password=HrManager%211");

    assertThat(response.status()).isEqualTo(415);
  }

  @Test
  void meWithoutSessionIsUnauthorized() {
    Response response = client().get("/api/auth/me");

    assertThat(response.status()).isEqualTo(401);
    assertThat(response.json().path("code").asText()).isEqualTo("AUTH_REQUIRED");
    assertThat(response.json().path("message").asText()).isEqualTo("로그인이 필요합니다.");
  }

  @Test
  void meAnswersForTheLoggedInAccountUntilLogout() {
    DemoAccount account = ACCOUNTS.get(2);
    ApiClient client = client();
    Response login = client.login(account.username(), account.password());
    assertThat(login.status()).isEqualTo(200);

    Response me = client.get("/api/auth/me");
    assertThat(me.status()).isEqualTo(200);
    expectAccountBody(me, account);
    assertThat(me.json()).isEqualTo(login.json());

    String sessionBeforeLogout = client.sessionId();
    Response logout = client.send("POST", "/api/auth/logout", null, null);
    assertThat(logout.status()).isEqualTo(204);

    client.useSessionId(sessionBeforeLogout);
    Response afterLogout = client.get("/api/auth/me");
    assertThat(afterLogout.status()).isEqualTo(401);
    assertThat(afterLogout.json().path("code").asText()).isEqualTo("AUTH_REQUIRED");
  }

  @Test
  void theSessionCookieIsHttpOnlyAndSameSiteStrict() {
    Response login = client().login("hr.manager", "HrManager!1");

    String cookie = login.sessionCookie();
    assertThat(cookie).as("로그인 응답의 JSESSIONID Set-Cookie").isNotNull();
    assertThat(cookie.toLowerCase()).contains("httponly").contains("samesite=strict");
  }

  @Test
  void loggingInAgainIssuesNewSessionAndRetiresOldOne() {
    ApiClient client = client();
    assertThat(client.login("hr.manager", "HrManager!1").status()).isEqualTo(200);
    String first = client.sessionId();
    assertThat(first).isNotNull();

    Response second = client.login("employee.demo", "Employee!1");
    assertThat(second.status()).isEqualTo(200);
    String secondSession = client.sessionId();
    assertThat(secondSession).isNotNull().isNotEqualTo(first);

    client.useSessionId(first);
    assertThat(client.get("/api/auth/me").status()).as("예전 세션 ID로 보낸 me").isEqualTo(401);
    client.useSessionId(secondSession);
    Response me = client.get("/api/auth/me");
    assertThat(me.status()).isEqualTo(200);
    assertThat(me.json().path("username").asText()).isEqualTo("employee.demo");
  }

  private void expectAccountBody(Response response, DemoAccount account) {
    JsonNode body = response.json();
    long employeeId =
        accountRepository.findByUsername(account.username()).orElseThrow().employeeId();
    Set<String> roles = new HashSet<>();
    body.path("roles").forEach(role -> roles.add(role.asText()));

    assertThat(body.path("username").asText()).isEqualTo(account.username());
    assertThat(body.path("employeeName").asText()).isEqualTo(account.employeeName());
    assertThat(body.path("employeeId").asLong()).isEqualTo(employeeId);
    assertThat(roles).as("%s의 역할", account.username()).isEqualTo(account.roles());
    assertThat(body.has("password")).isFalse();
    assertThat(body.has("passwordHash")).isFalse();
    assertThat(response.body()).as("응답에 BCrypt 해시가 없다").doesNotContain("$2a$");
  }

  private record DemoAccount(
      String username, String password, String employeeName, Set<String> roles) {}
}
