package com.ax.rms.web;

import com.ax.rms.support.AbstractApiTest;
import com.ax.rms.support.ApiClient;
import com.ax.rms.support.ApiClient.Response;
import java.time.LocalDate;

/**
 * T#10 배치 API 검사의 공용 도우미. 직원·프로젝트 ID는 저장소에서 이름·조건으로 찾아 숫자를 하드코딩하지 않는다
 * (계약서 "수용 기준").
 */
final class AllocationTestSupport {

  private AllocationTestSupport() {}

  /** 로그인한 project.manager 클라이언트를 돌려준다. */
  static ApiClient manager(AbstractApiTest test) {
    ApiClient client = test.client();
    Response login = client.login("project.manager", "ProjectManager!1");
    if (login.status() != 200) {
      throw new IllegalStateException("로그인에 실패했습니다: " + login.status() + " " + login.body());
    }
    return client;
  }

  /** 이름으로 직원의 ID를 찾는다. */
  static long employeeIdByName(AbstractApiTest test, String name) {
    return test.employeeRepository()
        .findAll().stream()
        .filter(e -> e.name().equals(name))
        .map(e -> e.id())
        .findFirst()
        .orElseThrow(() -> new IllegalStateException("시드에 없는 직원: " + name));
  }

  /** 이름으로 프로젝트의 ID를 찾는다. */
  static long projectIdByName(AbstractApiTest test, String name) {
    return test.projectRepository()
        .findAll().stream()
        .filter(p -> p.name().equals(name))
        .map(p -> p.id())
        .findFirst()
        .orElseThrow(() -> new IllegalStateException("시드에 없는 프로젝트: " + name));
  }

  /** 배치 생성 요청을 보내고 응답을 돌려준다. */
  static Response create(
      ApiClient client,
      long employeeId,
      long projectId,
      LocalDate start,
      LocalDate end,
      int percent) {
    String body =
        "{\"employeeId\": " + employeeId
            + ", \"projectId\": " + projectId
            + ", \"startDate\": \"" + start + "\""
            + ", \"endDate\": \"" + end + "\""
            + ", \"allocationPercent\": " + percent + "}";
    return client.sendJson("POST", "/api/assignments", body);
  }

  /** 배치 생성이 201이면 그 배치의 ID를, 아니면 실패를 드러내는 예외를 돌려준다. */
  static long created(
      ApiClient client,
      long employeeId,
      long projectId,
      LocalDate start,
      LocalDate end,
      int percent) {
    Response response = create(client, employeeId, projectId, start, end, percent);
    if (response.status() != 201) {
      throw new IllegalStateException("배치 생성 실패: " + response.status() + " " + response.body());
    }
    var id = response.json().get("id");
    if (id == null || id.isNull()) {
      throw new IllegalStateException("생성된 배치의 id가 없습니다: " + response.body());
    }
    return id.asLong();
  }

  /** 수정 요청을 보내고 응답을 돌려준다. */
  static Response patch(ApiClient client, long id, String partialBody) {
    return client.sendJson("PATCH", "/api/assignments/" + id, partialBody);
  }

  /** 해제 요청을 보내고 응답을 돌려준다. */
  static Response delete(ApiClient client, long id) {
    return client.send("DELETE", "/api/assignments/" + id, null, null);
  }

  /** 후보 직원 조회 요청을 보내고 응답을 돌려준다. */
  static Response candidates(ApiClient client, long projectId, LocalDate start, LocalDate end) {
    return client.get(
        "/api/assignments/candidates?projectId=" + projectId
            + "&startDate=" + start
            + "&endDate=" + end);
  }
}
