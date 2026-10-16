package com.ax.rms.web;

import static com.ax.rms.support.ErrorAssertions.assertError;
import static org.assertj.core.api.Assertions.assertThat;

import com.ax.rms.support.AbstractApiTest;
import com.ax.rms.support.ApiClient;
import com.ax.rms.support.ApiClient.Response;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;

/** T#56 기준 3: 같은 잘못된 요청은 API가 달라도 같은 400 {@code REQUEST_INVALID} 응답이다. */
class ErrorResponseConsistencyTest extends AbstractApiTest {

  private static final String MALFORMED = "{bad";

  @Test
  void brokenJsonGetsTheSameAnswerFromEveryWriteApi() {
    ApiClient hr = login("hr.manager", "HrManager!1");
    ApiClient pm = login("project.manager", "ProjectManager!1");
    List<Response> responses = new ArrayList<>();
    responses.add(hr.sendJson("POST", "/api/employees", MALFORMED));
    responses.add(hr.sendJson("PUT", "/api/employees/1", MALFORMED));
    responses.add(hr.sendJson("PATCH", "/api/employees/1/status", MALFORMED));
    responses.add(pm.sendJson("POST", "/api/projects", MALFORMED));
    responses.add(pm.sendJson("PUT", "/api/projects/1", MALFORMED));
    responses.add(pm.sendJson("POST", "/api/assignments", MALFORMED));
    responses.add(pm.sendJson("PATCH", "/api/assignments/1", MALFORMED));
    for (Response response : responses) {
      assertError(response, 400, "REQUEST_INVALID");
    }
    assertThat(responses.stream().map(r -> r.json().path("message").asText()).distinct())
        .as("모든 API의 message가 같다")
        .hasSize(1);
  }

  @Test
  void malformedQueriesAndPathValuesGetTheSameAnswer() {
    ApiClient hr = login("hr.manager", "HrManager!1");
    assertError(hr.get("/api/employees?status=FOO"), 400, "REQUEST_INVALID");
    assertError(hr.get("/api/employees?departmentId=abc"), 400, "REQUEST_INVALID");
    assertError(hr.get("/api/employees/abc"), 400, "REQUEST_INVALID");
    ApiClient pm = login("project.manager", "ProjectManager!1");
    assertError(pm.get("/api/projects/abc"), 400, "REQUEST_INVALID");
    assertError(pm.get("/api/assignments/candidates?startDate=2026-07-01&endDate=2026-07-31"),
        400, "REQUEST_INVALID");
    assertError(
        pm.get("/api/assignments/candidates?projectId=1&startDate=not-a-date&endDate=2026-07-31"),
        400,
        "REQUEST_INVALID");
  }

  private ApiClient login(String username, String password) {
    ApiClient client = client();
    assertThat(client.login(username, password).status()).isEqualTo(200);
    return client;
  }
}
