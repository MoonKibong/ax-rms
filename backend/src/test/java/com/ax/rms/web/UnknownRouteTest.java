package com.ax.rms.web;

import static com.ax.rms.support.ErrorAssertions.assertError;
import static org.assertj.core.api.Assertions.assertThat;

import com.ax.rms.support.AbstractApiTest;
import com.ax.rms.support.ApiClient;
import com.ax.rms.support.ApiClient.Response;
import org.junit.jupiter.api.Test;

/**
 * T#56 기준 5: 보안 규칙을 지난 요청의 404·405도 {@code {code, message}}다. 규칙 표에 없는 경로는 보안 설정이 먼저
 * 막으므로(T#6 {@code denyAll}) 404 검사는 규칙 표 안의 접두사({@code /api/employees/**}) 아래 없는 경로를 쓴다.
 */
class UnknownRouteTest extends AbstractApiTest {

  @Test
  void unmappedPathUnderAllowedPrefixIsNotFound() {
    ApiClient hr = client();
    hr.login("hr.manager", "HrManager!1");
    assertError(hr.get("/api/employees/1/no-such"), 404, "NOT_FOUND");
  }

  @Test
  void unsupportedMethodIsMethodNotAllowedWithAllowHeader() {
    ApiClient pm = client();
    pm.login("project.manager", "ProjectManager!1");
    Response response = pm.send("DELETE", "/api/projects/1", null, null);
    assertError(response, 405, "METHOD_NOT_ALLOWED");
    assertThat(response.headers("Allow")).isNotEmpty();
  }

  @Test
  void unauthenticatedUnknownPathStaysUnauthorized() {
    assertError(client().get("/api/no-such"), 401, "AUTH_REQUIRED");
  }
}
