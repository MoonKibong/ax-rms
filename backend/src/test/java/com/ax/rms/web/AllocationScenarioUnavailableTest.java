package com.ax.rms.web;

import static com.ax.rms.web.AllocationTestSupport.create;
import static com.ax.rms.web.AllocationTestSupport.employeeIdByName;
import static com.ax.rms.web.AllocationTestSupport.manager;
import static com.ax.rms.web.AllocationTestSupport.projectIdByName;
import static org.assertj.core.api.Assertions.assertThat;

import com.ax.rms.support.AbstractApiTest;
import com.ax.rms.support.ApiClient;
import com.ax.rms.support.ApiClient.Response;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

/**
 * T#10 §7 시나리오 (c) 투입 불가 직원: 시드에 투입 불가인 E2의 신규 배치는 400.
 */
class AllocationScenarioUnavailableTest extends AbstractApiTest {

  private ApiClient client;

  @BeforeEach
  void login() {
    client = manager(this);
  }

  @Test
  void unavailableScenario() {
    long e2 = employeeIdByName(this, "최동훈");
    long p4 = projectIdByName(this, "델타 프로젝트");
    Response response = create(client, e2, p4, FIXED_TODAY, FIXED_TODAY.plusDays(10), 20);
    assertThat(response.status()).isEqualTo(400);
    assertThat(response.json().get("code").asText()).isEqualTo("ASSIGNMENT_EMPLOYEE_UNAVAILABLE");
  }
}
