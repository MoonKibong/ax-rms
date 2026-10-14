package com.ax.rms.web;

import static com.ax.rms.web.AllocationTestSupport.delete;
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
 * T#10 §7 시나리오 (e) 배치 해제: 해제 후 E2의 배치가 비어지고 가용률이 100으로 돌아온다.
 */
class AllocationScenarioReleaseTest extends AbstractApiTest {

  private ApiClient client;

  @BeforeEach
  void login() {
    client = manager(this);
  }

  @Test
  void releaseScenario() {
    long e2 = employeeIdByName(this, "최동훈");
    long p3 = projectIdByName(this, "베타 프로젝트");
    Long id =
        this.assignmentRepository().findByEmployeeId(e2).stream()
            .filter(a -> a.projectId() == p3)
            .map(a -> a.id())
            .findFirst()
            .orElseThrow();
    Response response = delete(client, id);
    assertThat(response.status()).isEqualTo(204);
    assertThat(this.assignmentRepository().findByEmployeeId(e2)).isEmpty();
    int availability =
        this.calculator()
            .periodAvailability(
                this.assignmentRepository().findByEmployeeId(e2),
                FIXED_TODAY,
                FIXED_TODAY.plusDays(10));
    assertThat(availability).isEqualTo(100);
  }
}
