package com.ax.rms.project;

import static org.assertj.core.api.Assertions.assertThat;

import com.ax.rms.support.ApiClient;
import com.ax.rms.support.ApiClient.Response;
import com.fasterxml.jackson.databind.JsonNode;
import java.util.HashSet;
import java.util.Set;

/** T#9 API 검사가 같이 쓰는 확인과 로그인 도우미. */
final class ProjectApiAssertions {

  private ProjectApiAssertions() {}

  /**
   * 오류 응답을 확인한다(D33). 상태와 원인 코드가 맞고, 본문의 키가 정확히 {@code code}, {@code message} 둘뿐이며 메시지가 비어
   * 있지 않아야 한다. 키가 더 있거나 JSON이 아닌 본문(예: Spring 기본 오류)이면 실패한다.
   */
  static void assertApiError(Response response, int status, String code) {
    assertThat(response.status()).as("상태 (본문: %s)", response.body()).isEqualTo(status);
    JsonNode body = response.json();
    Set<String> keys = new HashSet<>();
    body.fieldNames().forEachRemaining(keys::add);
    assertThat(keys).as("오류 본문의 키").containsExactlyInAnyOrder("code", "message");
    assertThat(body.get("code").asText()).as("code").isEqualTo(code);
    assertThat(body.get("message").asText()).as("message").isNotBlank();
  }

  /** 프로젝트 관리자 데모 계정으로 로그인한 클라이언트를 돌려준다. */
  static ApiClient loginAsProjectManager(ApiClient client) {
    Response response = client.login("project.manager", "ProjectManager!1");
    assertThat(response.status()).as("project.manager 로그인").isEqualTo(200);
    return client;
  }
}
