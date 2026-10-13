package com.ax.rms.employee;

import static org.assertj.core.api.Assertions.assertThat;

import com.ax.rms.support.AbstractApiTest;
import com.ax.rms.support.AbstractSeedTest;
import com.ax.rms.support.ApiClient;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.Map;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;
import org.springframework.beans.factory.annotation.Autowired;

/**
 * T#28: 로그인한 계정의 직원 상세 {@code GET /api/me/employee}(D17, D24, D25). 직원 ID는 세션에서만 온다. 시드는 T#5의
 * 데이터이고, 상태를 바꾸는 검사는 마지막 순서다(이 클래스의 임시 DB에만 남는다).
 */
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
class MeEmployeeApiTest extends AbstractApiTest {

  /** 데모 계정 → 비밀번호와 연결된 직원 이름(SeedRunner {@code insertDemoAccounts}). */
  private static final Map<String, String[]> ACCOUNTS =
      Map.of(
          "employee.demo", new String[] {"Employee!1", "한지우"},
          "hr.manager", new String[] {"HrManager!1", "이수민"},
          "project.manager", new String[] {"ProjectManager!1", "정하늘"},
          "dual.manager", new String[] {"DualManager!1", "오승현"});

  @Autowired private ObjectMapper objectMapper;

  @Test
  @Order(1)
  void eachAccountGetsItsOwnEmployeeDetail() {
    ACCOUNTS.forEach(
        (username, value) -> {
          ApiClient client = loggedIn(username);
          ApiClient.Response me = client.get("/api/me/employee");
          assertThat(me.status()).as("%s status", username).isEqualTo(200);
          assertThat(me.json().get("name").asText()).as("%s name", username).isEqualTo(value[1]);
          long sessionEmployeeId = client.get("/api/auth/me").json().get("employeeId").asLong();
          assertThat(me.json().get("id").asLong()).as("%s id", username).isEqualTo(sessionEmployeeId);
        });
  }

  @Test
  @Order(2)
  void theBodyEqualsTheEmployeeDetailOfTheSameEmployee() {
    ApiClient manager = loggedIn("hr.manager");
    ACCOUNTS.keySet()
        .forEach(
            username -> {
              ApiClient.Response me = loggedIn(username).get("/api/me/employee");
              assertThat(me.status()).as("%s status", username).isEqualTo(200);
              JsonNode mine = me.json();
              JsonNode detail = manager.get("/api/employees/" + mine.get("id").asLong()).json();
              assertThat(mine).as("%s body", username).isEqualTo(detail);
            });
  }

  @Test
  @Order(3)
  void noRequestCanPickAnotherEmployee() {
    ApiClient client = loggedIn("employee.demo");

    for (String query : new String[] {"?id=1", "?employeeId=1"}) {
      ApiClient.Response me = client.get("/api/me/employee" + query);
      assertThat(me.status()).as("query %s status", query).isEqualTo(200);
      assertThat(me.json().get("name").asText()).as("query %s name", query).isEqualTo("한지우");
    }

    ApiClient.Response withId = client.get("/api/me/employee/1");
    assertThat(withId.status()).isEqualTo(404);
    assertThat(withId.body()).doesNotContain("박소영");

    ApiClient.Response other = client.get("/api/employees/1");
    assertThat(other.status()).isEqualTo(403);
    assertThat(other.json().get("code").asText()).isEqualTo("AUTH_FORBIDDEN");
  }

  @Test
  @Order(4)
  void anonymousIsUnauthorizedAndWritesAreForbidden() {
    ApiClient.Response anonymous = client().get("/api/me/employee");
    assertThat(anonymous.status()).isEqualTo(401);
    assertThat(anonymous.json().get("code").asText()).isEqualTo("AUTH_REQUIRED");

    for (String username : new String[] {"employee.demo", "dual.manager"}) {
      ApiClient client = loggedIn(username);
      for (String method : new String[] {"PUT", "PATCH", "POST", "DELETE"}) {
        ApiClient.Response write = client.sendJson(method, "/api/me/employee", "{}");
        assertThat(write.status()).as("%s %s status", username, method).isEqualTo(403);
        assertThat(write.json().get("code").asText()).isEqualTo("AUTH_FORBIDDEN");
      }
    }
  }

  @Test
  @Order(5)
  void aStatusChangeShowsOnTheNextCall() throws Exception {
    ApiClient employee = loggedIn("employee.demo");
    long id = employee.get("/api/auth/me").json().get("employeeId").asLong();

    String change =
        objectMapper.writeValueAsString(
            Map.of(
                "availabilityStatus", "UNAVAILABLE",
                "unavailableReason", "교육",
                "unavailableUntil", AbstractSeedTest.FIXED_TODAY.plusDays(30).toString()));
    ApiClient.Response changed =
        loggedIn("hr.manager").sendJson("PATCH", "/api/employees/" + id + "/status", change);
    assertThat(changed.status()).isEqualTo(200);

    ApiClient.Response me = employee.get("/api/me/employee");
    assertThat(me.status()).isEqualTo(200);
    assertThat(me.json().get("availabilityStatus").asText()).isEqualTo("UNAVAILABLE");
    assertThat(me.json().get("unavailableReason").asText()).isEqualTo("교육");
  }

  private ApiClient loggedIn(String username) {
    ApiClient client = client();
    ApiClient.Response login = client.login(username, ACCOUNTS.get(username)[0]);
    assertThat(login.status()).as("%s login", username).isEqualTo(200);
    return client;
  }
}
