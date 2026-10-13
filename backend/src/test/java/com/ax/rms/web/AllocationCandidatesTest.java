package com.ax.rms.web;

import static com.ax.rms.web.AllocationTestSupport.candidates;
import static com.ax.rms.web.AllocationTestSupport.employeeIdByName;
import static com.ax.rms.web.AllocationTestSupport.manager;
import static com.ax.rms.web.AllocationTestSupport.projectIdByName;
import static org.assertj.core.api.Assertions.assertThat;

import com.ax.rms.support.AbstractApiTest;
import com.ax.rms.support.ApiClient;
import com.ax.rms.support.ApiClient.Response;
import com.fasterxml.jackson.databind.JsonNode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

/**
 * T#10 기준 13: 기간별 후보 직원 가용률 조회.
 */
class AllocationCandidatesTest extends AbstractApiTest {

  private ApiClient client;

  @BeforeEach
  void login() {
    client = manager(this);
  }

  @Test
  void candidateList() {
    long p3 = projectIdByName(this, "베타 프로젝트");
    Response response = candidates(client, p3, FIXED_TODAY, FIXED_TODAY.plusDays(10));
    assertThat(response.status()).isEqualTo(200);
    JsonNode list = response.json();
    assertThat(list.isArray()).isTrue();

    long e1 = employeeIdByName(this, "박소영");
    long e2 = employeeIdByName(this, "최동훈");
    JsonNode e1Entry = entryFor(list, e1);
    JsonNode e2Entry = entryFor(list, e2);
    assertThat(e1Entry.get("name").asText()).isEqualTo("박소영");
    assertThat(e1Entry.get("availabilityStatus").asText()).isEqualTo("AVAILABLE");
    assertThat(e1Entry.get("periodAvailability").asInt()).isEqualTo(40);
    assertThat(e2Entry.get("availabilityStatus").asText()).isEqualTo("UNAVAILABLE");
  }

  private static JsonNode entryFor(JsonNode list, long employeeId) {
    for (JsonNode entry : list) {
      if (entry.get("employeeId").asLong() == employeeId) {
        return entry;
      }
    }
    throw new AssertionError("후보 목록에 없는 직원: " + employeeId);
  }
}
