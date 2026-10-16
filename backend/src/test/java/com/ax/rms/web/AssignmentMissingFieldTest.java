package com.ax.rms.web;

import static com.ax.rms.support.ErrorAssertions.assertError;

import com.ax.rms.support.AbstractApiTest;
import com.ax.rms.support.ApiClient;
import org.junit.jupiter.api.Test;

/** T#56 기준 8: 배치 생성 본문에서 필수 값이 빠지면 400 {@code ASSIGNMENT_REQUEST_INVALID}다. */
class AssignmentMissingFieldTest extends AbstractApiTest {

  @Test
  void missingRequiredFieldIsRequestInvalid() {
    ApiClient pm = client();
    pm.login("project.manager", "ProjectManager!1");
    long employeeId = employeeRepository().findAll().get(0).id();
    long projectId = projectRepository().findAll().get(0).id();
    String dates = "\"startDate\":\"2026-07-01\",\"endDate\":\"2026-07-31\"";
    String employee = "\"employeeId\":" + employeeId;
    String project = "\"projectId\":" + projectId;
    String percent = "\"allocationPercent\":20";

    assertError(post(pm, project, dates, percent), 400, "ASSIGNMENT_REQUEST_INVALID");
    assertError(post(pm, employee, dates, percent), 400, "ASSIGNMENT_REQUEST_INVALID");
    assertError(post(pm, employee, project, dates), 400, "ASSIGNMENT_REQUEST_INVALID");
  }

  private static ApiClient.Response post(ApiClient client, String... fields) {
    return client.sendJson("POST", "/api/assignments", "{" + String.join(",", fields) + "}");
  }
}
