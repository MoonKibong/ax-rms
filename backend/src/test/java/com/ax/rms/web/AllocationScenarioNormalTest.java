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
 * T#10 §7 시나리오 (a) 정상 배치: 배치 후 E1의 그 기간 가용률이 10(100−90).
 */
class AllocationScenarioNormalTest extends AbstractApiTest {

  private ApiClient client;

  @BeforeEach
  void login() {
    client = manager(this);
  }

  @Test
  void normalScenario() {
    long e1 = employeeIdByName(this, "박소영");
    long p3 = projectIdByName(this, "베타 프로젝트");
    Response response = create(client, e1, p3, FIXED_TODAY, FIXED_TODAY.plusDays(10), 30);
    assertThat(response.status()).isEqualTo(201);
    int availability =
        this.calculator()
            .periodAvailability(
                this.assignmentRepository().findByEmployeeId(e1),
                FIXED_TODAY,
                FIXED_TODAY.plusDays(10));
    assertThat(availability).isEqualTo(10);
  }
}
