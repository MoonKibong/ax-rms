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
 * T#10 §7 시나리오 (b) 투입률 초과: E1의 P1 60%에 P3 50%를 겹치면 400.
 */
class AllocationScenarioOverAllocatedTest extends AbstractApiTest {

  private ApiClient client;

  @BeforeEach
  void login() {
    client = manager(this);
  }

  @Test
  void overAllocatedScenario() {
    long e1 = employeeIdByName(this, "박소영");
    long p3 = projectIdByName(this, "베타 프로젝트");
    Response response = create(client, e1, p3, FIXED_TODAY, FIXED_TODAY.plusDays(10), 50);
    assertThat(response.status()).isEqualTo(400);
    assertThat(response.json().get("code").asText()).isEqualTo("ASSIGNMENT_OVER_ALLOCATED");
  }
}
