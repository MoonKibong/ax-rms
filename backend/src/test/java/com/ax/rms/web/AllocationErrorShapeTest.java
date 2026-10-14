package com.ax.rms.web;

import static com.ax.rms.web.AllocationTestSupport.create;
import static com.ax.rms.web.AllocationTestSupport.employeeIdByName;
import static com.ax.rms.web.AllocationTestSupport.manager;
import static com.ax.rms.web.AllocationTestSupport.patch;
import static com.ax.rms.web.AllocationTestSupport.projectIdByName;
import static org.assertj.core.api.Assertions.assertThat;

import com.ax.rms.support.AbstractApiTest;
import com.ax.rms.support.ApiClient;
import com.ax.rms.support.ApiClient.Response;
import com.fasterxml.jackson.databind.JsonNode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

/**
 * T#10 기준 15: 415와 4xx 오류 본문 모양(키는 code·message 둘뿐, D33).
 */
class AllocationErrorShapeTest extends AbstractApiTest {

  private ApiClient client;

  @BeforeEach
  void login() {
    client = manager(this);
  }

  @Test
  void unsupportedMediaType() {
    Response response = client.send("POST", "/api/assignments", "text/plain", "hello");
    assertThat(response.status()).isEqualTo(415);
    assertThat(response.json().get("code").asText()).isEqualTo("UNSUPPORTED_MEDIA_TYPE");
    assertThat(errorKeys(response.json())).containsExactlyInAnyOrder("code", "message");
  }

  @Test
  void businessErrorsHaveOnlyCodeAndMessage() {
    long e1 = employeeIdByName(this, "박소영");
    long p3 = projectIdByName(this, "베타 프로젝트");
    Response badPercent = create(client, e1, p3, FIXED_TODAY, FIXED_TODAY.plusDays(10), 7);
    assertThat(badPercent.status()).isEqualTo(400);
    assertThat(errorKeys(badPercent.json())).containsExactlyInAnyOrder("code", "message");

    Response notFound = patch(client, 999999, "{\"allocationPercent\": 40}");
    assertThat(notFound.status()).isEqualTo(404);
    assertThat(errorKeys(notFound.json())).containsExactlyInAnyOrder("code", "message");
  }

  @Test
  void malformedRequestsHaveOnlyCodeAndMessage() {
    Response[] responses = {
      client.sendJson("POST", "/api/assignments", "{not json"),
      client.sendJson("PATCH", "/api/assignments/abc", "{\"allocationPercent\": 40}"),
      client.send("DELETE", "/api/assignments/abc", null, null),
      client.get("/api/assignments/candidates"),
      client.get(
          "/api/assignments/candidates?projectId=1&startDate=not-a-date&endDate=2026-06-30"),
    };
    for (Response response : responses) {
      assertThat(response.status()).as("status").isEqualTo(400);
      assertThat(errorKeys(response.json()))
          .as("keys of %s", response.body())
          .containsExactlyInAnyOrder("code", "message");
    }
  }

  private static java.util.List<String> errorKeys(JsonNode body) {
    java.util.List<String> keys = new java.util.ArrayList<>();
    body.fieldNames().forEachRemaining(keys::add);
    return keys;
  }
}
