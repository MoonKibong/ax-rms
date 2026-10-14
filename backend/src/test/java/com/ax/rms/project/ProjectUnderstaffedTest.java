package com.ax.rms.project;

import static com.ax.rms.project.ProjectApiAssertions.loginAsProjectManager;
import static org.assertj.core.api.Assertions.assertThat;

import com.ax.rms.domain.Assignment;
import com.ax.rms.domain.EmployeeSkill;
import com.ax.rms.repository.EmployeeSkillRepository;
import com.ax.rms.support.AbstractApiTest;
import com.ax.rms.support.ApiClient;
import com.ax.rms.support.ApiClient.Response;
import com.fasterxml.jackson.databind.JsonNode;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import java.util.TreeSet;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;
import org.springframework.beans.factory.annotation.Autowired;

/**
 * T#32 기준 1–3: 프로젝트 목록 API의 {@code understaffed}(D20). 판정은 #11의 {@code
 * DashboardService.shortStaffedProjectIds} 하나이고(D36), 이 검사는 같은 프로젝트를 대시보드 API가 가리키는지도 본다. 한
 * 클래스가 DB 하나를 나눠 쓰므로, 시드를 읽는 검사가 먼저({@code @Order} 1–3)고 배치를 바꾸는 검사가 마지막(4)이다.
 */
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
class ProjectUnderstaffedTest extends AbstractApiTest {

  @Autowired private EmployeeSkillRepository skillRepository;

  private static final List<String> SEEDED =
      List.of("알파 프로젝트", "감마 프로젝트", "베타 프로젝트", "델타 프로젝트", "엡실론 프로젝트");

  private ApiClient manager() {
    return loginAsProjectManager(client());
  }

  private JsonNode listBody(ApiClient client, String query) {
    Response response = client.get("/api/projects" + query);
    assertThat(response.status()).as("목록 상태 (본문: %s)", response.body()).isEqualTo(200);
    return response.json();
  }

  /** 이름 → understaffed. 키가 빠졌거나 boolean이 아니면 실패한다. */
  private Map<String, Boolean> flags(JsonNode items) {
    Map<String, Boolean> result = new TreeMap<>();
    for (JsonNode item : items) {
      JsonNode flag = item.get("understaffed");
      assertThat(flag).as("%s의 understaffed", item.get("name").asText()).isNotNull();
      assertThat(flag.isBoolean())
          .as("%s의 understaffed는 boolean", item.get("name").asText())
          .isTrue();
      result.put(item.get("name").asText(), flag.asBoolean());
    }
    return result;
  }

  private Set<Long> flaggedIds(JsonNode items) {
    Set<Long> ids = new TreeSet<>();
    for (JsonNode item : items) {
      if (item.path("understaffed").asBoolean(false)) {
        ids.add(item.get("id").asLong());
      }
    }
    return ids;
  }

  private Set<Long> dashboardIds(ApiClient client) {
    Response response = client.get("/api/dashboard");
    assertThat(response.status()).as("대시보드 상태 (본문: %s)", response.body()).isEqualTo(200);
    Set<Long> ids = new TreeSet<>();
    for (JsonNode item : response.json().path("shortStaffedProjects")) {
      ids.add(item.get("id").asLong());
    }
    return ids;
  }

  private long projectId(String name) {
    return projectRepository().findAll().stream()
        .filter(project -> project.name().equals(name))
        .map(project -> project.id())
        .findFirst()
        .orElseThrow(() -> new IllegalStateException("시드에 없는 프로젝트: " + name));
  }

  private long employeeId(String name) {
    return employeeRepository().findAll().stream()
        .filter(employee -> employee.name().equals(name))
        .map(employee -> employee.id())
        .findFirst()
        .orElseThrow(() -> new IllegalStateException("시드에 없는 직원: " + name));
  }

  private void assignToday(long employeeId, long projectId) {
    assignmentRepository()
        .insert(
            new Assignment(
                null,
                employeeId,
                projectId,
                FIXED_TODAY.minusDays(1),
                FIXED_TODAY.plusDays(1),
                20));
  }

  /** 모든 프로젝트가 같은 상태 값(예상 이름 → 값)인지 확인한다. */
  private void assertFlags(ApiClient client, Map<String, Boolean> expected, String when) {
    JsonNode items = listBody(client, "");
    assertThat(flags(items)).as("%s: 이름별 understaffed", when).isEqualTo(expected);
    // 판정은 상태 필터와 무관하다: 필터로 불러도 보이는 항목은 같은 값이다.
    JsonNode inProgress = listBody(client, "?status=IN_PROGRESS");
    Map<String, Boolean> filtered = flags(inProgress);
    for (Map.Entry<String, Boolean> entry : filtered.entrySet()) {
      assertThat(entry.getValue())
          .as("%s: 필터 %s", when, entry.getKey())
          .isEqualTo(expected.get(entry.getKey()));
    }
    // 대시보드 API가 가리키는 프로젝트와 같은 집합이다(D36).
    assertThat(flaggedIds(items)).as("%s: 대시보드와 같은 프로젝트", when).isEqualTo(dashboardIds(client));
  }

  private Map<String, Boolean> only(String... flagged) {
    Map<String, Boolean> expected = new TreeMap<>();
    for (String name : SEEDED) {
      expected.put(name, false);
    }
    for (String name : flagged) {
      expected.put(name, true);
    }
    return expected;
  }

  @Test
  @Order(1)
  void seeded() {
    JsonNode items = listBody(manager(), "");

    assertThat(items).hasSize(SEEDED.size());
    assertThat(flags(items)).isEqualTo(only());
  }

  @Test
  @Order(2)
  void statusFilterKeepsTheValue() {
    ApiClient client = manager();

    for (String status : List.of("IN_PROGRESS", "DONE", "PLANNED", "ON_HOLD")) {
      JsonNode items = listBody(client, "?status=" + status);
      assertThat(items.size()).as("%s 항목 수", status).isGreaterThan(0);
      assertThat(flags(items).values()).as("%s 필터의 값", status).containsOnly(false);
    }
  }

  @Test
  @Order(3)
  void sameProjectsAsDashboard() {
    ApiClient client = manager();

    assertThat(flaggedIds(listBody(client, ""))).isEqualTo(dashboardIds(client)).isEmpty();
  }

  @Test
  @Order(4)
  void shortStaffedCases() {
    long alpha = projectId("알파 프로젝트");

    // (a) 알파의 오늘 배치를 전부 지운다 → 오늘 배치 0 < 필요 2.
    List<Assignment> todays = new ArrayList<>();
    for (Assignment assignment : assignmentRepository().findByProjectId(alpha)) {
      boolean today =
          !FIXED_TODAY.isBefore(assignment.startDate())
              && !FIXED_TODAY.isAfter(assignment.endDate());
      if (today) {
        todays.add(assignment);
      }
    }
    assertThat(todays).as("알파의 오늘 배치").hasSize(3);
    todays.forEach(assignment -> assignmentRepository().delete(assignment.id()));
    ApiClient client = manager();
    assertFlags(client, only("알파 프로젝트"), "(a) 배치 없음");

    // (b) Java가 없는 직원 둘을 오늘 포함 배정으로 더한다 → 인원은 2 = 필요 2지만 필요 역량의 기술 보유자가 없다.
    long javaless1 = employeeId("임도윤");
    long javaless2 = employeeId("안유진");
    assertThat(employeeSkillsOf(javaless1, javaless2)).as("임도윤·안유진의 기술").doesNotContain("Java");
    assignToday(javaless1, alpha);
    assignToday(javaless2, alpha);
    assertFlags(client, only("알파 프로젝트"), "(b) Java 보유자 없음");

    // (c) Java 보유자 박소영과 한지우를 더한다 → 인원 4 ≥ 2이고 Java 보유자가 있다.
    assignToday(employeeId("박소영"), alpha);
    assignToday(employeeId("한지우"), alpha);
    assertFlags(client, only(), "(c) Java 보유자 배치");
  }

  private List<String> employeeSkillsOf(long... employeeIds) {
    List<String> names = new ArrayList<>();
    for (long employeeId : employeeIds) {
      for (EmployeeSkill skill : skillRepository.findByEmployeeId(employeeId)) {
        names.add(skill.skillName());
      }
    }
    return names;
  }

}
