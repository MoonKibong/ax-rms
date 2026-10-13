package com.ax.rms.web;

import static com.ax.rms.web.AllocationTestSupport.employeeIdByName;
import static com.ax.rms.web.AllocationTestSupport.manager;
import static com.ax.rms.web.AllocationTestSupport.patch;
import static com.ax.rms.web.AllocationTestSupport.projectIdByName;
import static org.assertj.core.api.Assertions.assertThat;

import com.ax.rms.support.AbstractApiTest;
import com.ax.rms.support.ApiClient;
import com.ax.rms.support.ApiClient.Response;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

/**
 * T#10 §7 시나리오 (f) 상태 변경: 시드의 E2가 이미 투입 불가 상태이므로, 기존 배치는 유지되고
 * 상향은 400·하향은 200이다(상태 변경 API는 T#8, 대시보드 표시는 T#11).
 */
class AllocationScenarioStatusChangeTest extends AbstractApiTest {

  private ApiClient client;

  @BeforeEach
  void login() {
    client = manager(this);
  }

  @Test
  void statusChangeScenario() {
    long e2 = employeeIdByName(this, "최동훈");
    long p3 = projectIdByName(this, "베타 프로젝트");
    Long id =
        this.assignmentRepository().findByEmployeeId(e2).stream()
            .filter(a -> a.projectId() == p3)
            .map(a -> a.id())
            .findFirst()
            .orElseThrow();
    Response raised = patch(client, id, "{\"allocationPercent\": 45}");
    assertThat(raised.status()).isEqualTo(400);
    assertThat(raised.json().get("code").asText())
        .isEqualTo("ASSIGNMENT_MODIFY_FORBIDDEN_UNAVAILABLE");
    Response lowered = patch(client, id, "{\"allocationPercent\": 20}");
    assertThat(lowered.status()).isEqualTo(200);
  }
}
