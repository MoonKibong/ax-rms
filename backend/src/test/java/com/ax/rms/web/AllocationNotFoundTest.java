package com.ax.rms.web;

import static com.ax.rms.web.AllocationTestSupport.create;
import static com.ax.rms.web.AllocationTestSupport.delete;
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
 * T#10 기준 3: 없는 직원·프로젝트·배치에 대한 404 응답과 원인 코드.
 */
class AllocationNotFoundTest extends AbstractApiTest {

  private ApiClient client;

  @BeforeEach
  void login() {
    client = manager(this);
  }

  @Test
  void missingEmployeeOnPost() {
    long p3 = projectIdByName(this, "베타 프로젝트");
    Response response = create(client, 999999, p3, FIXED_TODAY, FIXED_TODAY.plusDays(10), 20);
    assertThat(response.status()).isEqualTo(404);
    assertThat(response.json().path("code").asText()).isEqualTo("ASSIGNMENT_EMPLOYEE_NOT_FOUND");
  }

  @Test
  void missingProjectOnPost() {
    long e1 = employeeIdByName(this, "박소영");
    Response response = create(client, e1, 999999, FIXED_TODAY, FIXED_TODAY.plusDays(10), 20);
    assertThat(response.status()).isEqualTo(404);
    assertThat(response.json().path("code").asText()).isEqualTo("ASSIGNMENT_PROJECT_NOT_FOUND");
  }

  @Test
  void missingProjectComesBeforeTheUnavailableEmployeeRule() {
    long e2 = employeeIdByName(this, "최동훈");
    Response response = create(client, e2, 999999, FIXED_TODAY, FIXED_TODAY.plusDays(10), 20);
    assertThat(response.status()).isEqualTo(404);
    assertThat(response.json().path("code").asText()).isEqualTo("ASSIGNMENT_PROJECT_NOT_FOUND");
  }

  @Test
  void missingAssignmentOnPatch() {
    Response response = patch(client, 999999, "{\"allocationPercent\": 40}");
    assertThat(response.status()).isEqualTo(404);
    assertThat(response.json().path("code").asText()).isEqualTo("ASSIGNMENT_NOT_FOUND");
  }

  @Test
  void missingAssignmentOnDelete() {
    Response response = delete(client, 999999);
    assertThat(response.status()).isEqualTo(404);
    assertThat(response.json().path("code").asText()).isEqualTo("ASSIGNMENT_NOT_FOUND");
  }
}
