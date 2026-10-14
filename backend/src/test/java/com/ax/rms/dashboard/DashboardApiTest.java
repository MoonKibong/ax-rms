package com.ax.rms.dashboard;

import static org.assertj.core.api.Assertions.assertThat;

import com.ax.rms.repository.DepartmentRepository;
import com.ax.rms.support.AbstractApiTest;
import com.ax.rms.support.ApiClient;
import com.ax.rms.support.ApiClient.Response;
import com.fasterxml.jackson.databind.JsonNode;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/**
 * T#11 대시보드 API 검사(기준 1–6). 고정 시계 2026-06-15와 T#5 시드를 쓴다. ID는 저장소에서 이름으로
 * 찾아 숫자를 하드코딩하지 않는다.
 */
class DashboardApiTest extends AbstractApiTest {

  @Autowired private DepartmentRepository departmentRepository;

  private ApiClient client;

  @BeforeEach
  void login() {
    client = this.client();
    Response login = client.login("project.manager", "ProjectManager!1");
    assertThat(login.status()).as("로그인 상태").isEqualTo(200);
  }

  /** 대시보드를 불러온다. 200이 아니면 실패를 드러낸다. */
  private JsonNode dashboardBody() {
    Response response = client.get("/api/dashboard");
    assertThat(response.status()).as("대시보드 상태").isEqualTo(200);
    return response.json();
  }

  @Test
  void dashboard() {
    JsonNode body = dashboardBody();
    assertThat(body.path("employeeCount").asInt()).isEqualTo(20);
    assertThat(body.path("availableCount").asInt()).isEqualTo(19);
    assertThat(body.path("unavailableCount").asInt()).isEqualTo(1);
    assertThat(body.path("availableHeadcount").asInt()).isEqualTo(19);
    assertThat(body.path("ongoingProjectCount").asInt()).isEqualTo(2);
    JsonNode needsReview = body.path("needsReview");
    assertThat(needsReview.size()).isEqualTo(1);
    assertThat(needsReview.get(0).path("id").asLong()).isEqualTo(employeeIdByName("최동훈"));
    assertThat(needsReview.get(0).path("name").asText()).isEqualTo("최동훈");
  }

  @Test
  void shortStaffed() {
    JsonNode body = dashboardBody();
    assertThat(body.path("shortStaffedProjects").size()).as("인력 부족 프로젝트").isZero();
  }

  @Test
  void perEmployee() {
    JsonNode body = dashboardBody();
    JsonNode employees = body.path("employees");
    assertThat(employees.size()).isEqualTo(20);
    List<Long> ids = new ArrayList<>();
    Map<Long, Integer> availability = new HashMap<>();
    for (JsonNode e : employees) {
      ids.add(e.path("id").asLong());
      availability.put(e.path("id").asLong(), e.path("currentAvailability").asInt());
    }
    List<Long> sorted = new ArrayList<>(ids);
    sorted.sort(Long::compareTo);
    assertThat(ids).as("id 오름차순").isEqualTo(sorted);

    assertThat(availability.get(employeeIdByName("박소영"))).isEqualTo(40);
    assertThat(availability.get(employeeIdByName("최동훈"))).isEqualTo(60);
    assertThat(availability.get(employeeIdByName("이수민"))).isEqualTo(100);
    assertThat(availability.get(employeeIdByName("정하늘"))).isEqualTo(100);
    assertThat(availability.get(employeeIdByName("한지우"))).isEqualTo(100);
    assertThat(availability.get(employeeIdByName("오승현"))).isEqualTo(100);
    assertThat(availability.get(employeeIdByName("강민재"))).isEqualTo(60);
    assertThat(availability.get(employeeIdByName("윤서아"))).isEqualTo(100);
    assertThat(availability.get(employeeIdByName("임도윤"))).isEqualTo(35);
    assertThat(availability.get(employeeIdByName("조하준"))).isEqualTo(100);
    assertThat(availability.get(employeeIdByName("장지호"))).isEqualTo(100);
    assertThat(availability.get(employeeIdByName("유시우"))).isEqualTo(70);
    assertThat(availability.get(employeeIdByName("신예은"))).isEqualTo(30);
    assertThat(availability.get(employeeIdByName("권지안"))).isEqualTo(55);
    assertThat(availability.get(employeeIdByName("황서윤"))).isEqualTo(100);
    assertThat(availability.get(employeeIdByName("안유진"))).isEqualTo(75);
    assertThat(availability.get(employeeIdByName("송민서"))).isEqualTo(100);
    assertThat(availability.get(employeeIdByName("문채원"))).isEqualTo(55);
    assertThat(availability.get(employeeIdByName("백주원"))).isEqualTo(100);
    assertThat(availability.get(employeeIdByName("서하윤"))).isEqualTo(100);
  }

  @Test
  void departmentAverage() {
    JsonNode body = dashboardBody();
    JsonNode departments = body.path("departments");
    assertThat(departments.size()).isEqualTo(3);
    List<Long> ids = new ArrayList<>();
    Map<Long, Double> averages = new HashMap<>();
    for (JsonNode d : departments) {
      ids.add(d.path("id").asLong());
      averages.put(d.path("id").asLong(), d.path("averageAvailability").asDouble());
    }
    List<Long> sorted = new ArrayList<>(ids);
    sorted.sort(Long::compareTo);
    assertThat(ids).as("id 오름차순").isEqualTo(sorted);

    assertThat(averages.get(departmentIdByName("개발팀"))).as("개발팀 평균").isEqualTo(70.6);
    assertThat(averages.get(departmentIdByName("기획팀"))).as("기획팀 평균").isEqualTo(93.6);
    assertThat(averages.get(departmentIdByName("디자인팀"))).as("디자인팀 평균").isEqualTo(72.0);
  }

  @Test
  void consistencyWithEmployeeAndProjectApis() {
    JsonNode dash = dashboardBody();
    Map<Long, Integer> dashboardAvailability = new HashMap<>();
    for (JsonNode e : dash.path("employees")) {
      dashboardAvailability.put(e.path("id").asLong(), e.path("currentAvailability").asInt());
    }

    Response employeesResponse = client.get("/api/employees");
    assertThat(employeesResponse.status()).as("직원 목록 상태").isEqualTo(200);
    JsonNode employees = employeesResponse.json();
    assertThat(employees.size()).isEqualTo(20);
    for (JsonNode e : employees) {
      long id = e.path("id").asLong();
      assertThat(dashboardAvailability.get(id))
          .as("직원 id %d의 현재 가용률(직원 API와 대시보드)", id)
          .isEqualTo(e.path("currentAvailability").asInt());
    }

    for (var project : this.projectRepository().findAll()) {
      Response detail = client.get("/api/projects/" + project.id());
      assertThat(detail.status()).as("프로젝트 상세 상태(%s)", project.name()).isEqualTo(200);
      for (JsonNode a : detail.json().path("assignments")) {
        long employeeId = a.path("employeeId").asLong();
        assertThat(dashboardAvailability.get(employeeId))
            .as("직원 id %d의 현재 가용률(프로젝트 %s 상세와 대시보드)", employeeId, project.name())
            .isEqualTo(a.path("currentAvailability").asInt());
      }
    }

    Set<Long> inAlpha = new HashSet<>();
    for (JsonNode a :
        client.get("/api/projects/" + projectIdByName("알파 프로젝트")).json().path("assignments")) {
      inAlpha.add(a.path("employeeId").asLong());
    }
    assertThat(inAlpha)
        .as("알파 상세의 오늘 배치는 시드와 같다")
        .contains(
            employeeIdByName("박소영"), employeeIdByName("강민재"), employeeIdByName("권지안"));
  }

  private long employeeIdByName(String name) {
    return this.employeeRepository()
        .findAll().stream()
        .filter(e -> e.name().equals(name))
        .map(e -> e.id())
        .findFirst()
        .orElseThrow(() -> new IllegalStateException("시드에 없는 직원: " + name));
  }

  private long projectIdByName(String name) {
    return this.projectRepository()
        .findAll().stream()
        .filter(p -> p.name().equals(name))
        .map(p -> p.id())
        .findFirst()
        .orElseThrow(() -> new IllegalStateException("시드에 없는 프로젝트: " + name));
  }

  private long departmentIdByName(String name) {
    return departmentRepository
        .findAll().stream()
        .filter(d -> d.name().equals(name))
        .map(d -> d.id())
        .findFirst()
        .orElseThrow(() -> new IllegalStateException("시드에 없는 부서: " + name));
  }
}
