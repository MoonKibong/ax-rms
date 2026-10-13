package com.ax.rms.project;

import static com.ax.rms.project.ProjectApiAssertions.assertApiError;
import static com.ax.rms.project.ProjectApiAssertions.loginAsProjectManager;
import static org.assertj.core.api.Assertions.assertThat;

import com.ax.rms.domain.Project;
import com.ax.rms.repository.ProjectRepository;
import com.ax.rms.support.AbstractApiTest;
import com.ax.rms.support.ApiClient;
import com.ax.rms.support.ApiClient.Response;
import com.fasterxml.jackson.databind.JsonNode;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/**
 * T#9 기준 1–4: 프로젝트 조회 API. 값은 T#5 시드를 고정 시계 2026-06-15로 계산한 T#9 계약서의 표다. 이 클래스의 테스트는 DB를
 * 바꾸지 않는다.
 */
class ProjectReadApiTest extends AbstractApiTest {

  @Autowired private ProjectRepository projectRepository;

  private record Expected(
      String name,
      String status,
      String startDate,
      String endDate,
      int requiredHeadcount,
      int assignedHeadcount) {}

  private static final List<Expected> SEEDED =
      List.of(
          new Expected("알파 프로젝트", "IN_PROGRESS", "2026-05-16", "2026-09-13", 2, 3),
          new Expected("감마 프로젝트", "DONE", "2025-10-08", "2026-03-07", 2, 0),
          new Expected("베타 프로젝트", "IN_PROGRESS", "2026-05-26", "2026-08-14", 2, 3),
          new Expected("델타 프로젝트", "PLANNED", "2026-07-15", "2026-10-13", 2, 0),
          new Expected("엡실론 프로젝트", "ON_HOLD", "2026-04-16", "2026-07-15", 2, 3));

  private ApiClient manager() {
    return loginAsProjectManager(client());
  }

  private Map<String, Long> idByName() {
    return projectRepository.findAll().stream()
        .collect(Collectors.toMap(Project::name, Project::id));
  }

  @Test
  void list() {
    Response response = manager().get("/api/projects");

    assertThat(response.status()).as("상태 (본문: %s)", response.body()).isEqualTo(200);
    JsonNode items = response.json();
    assertThat(items.isArray()).isTrue();
    assertThat(items).hasSize(SEEDED.size());
    Map<String, Long> ids = idByName();
    long previousId = 0;
    for (int i = 0; i < SEEDED.size(); i += 1) {
      Expected expected = SEEDED.get(i);
      JsonNode item = items.get(i);
      String name = expected.name();
      long id = item.get("id").asLong();
      assertThat(id).as("%s id", name).isEqualTo(ids.get(name));
      assertThat(id).as("id 오름차순").isGreaterThan(previousId);
      previousId = id;
      assertThat(item.get("name").asText()).isEqualTo(name);
      assertThat(item.get("status").asText()).as("%s 상태", name).isEqualTo(expected.status());
      assertThat(item.get("startDate").asText()).as("%s 시작일", name).isEqualTo(expected.startDate());
      assertThat(item.get("endDate").asText()).as("%s 종료일", name).isEqualTo(expected.endDate());
      assertThat(item.get("requiredHeadcount").asInt())
          .as("%s 필요", name)
          .isEqualTo(expected.requiredHeadcount());
      assertThat(item.get("assignedHeadcount").asInt())
          .as("%s 오늘 배치", name)
          .isEqualTo(expected.assignedHeadcount());
    }
  }

  @Test
  void statusFilter() {
    ApiClient client = manager();

    assertThat(namesFor(client, "IN_PROGRESS")).containsExactly("알파 프로젝트", "베타 프로젝트");
    assertThat(namesFor(client, "DONE")).containsExactly("감마 프로젝트");
    assertThat(namesFor(client, "PLANNED")).containsExactly("델타 프로젝트");
    assertThat(namesFor(client, "ON_HOLD")).containsExactly("엡실론 프로젝트");

    assertApiError(client.get("/api/projects?status=ACTIVE"), 400, "PROJECT_STATUS_INVALID");
  }

  private List<String> namesFor(ApiClient client, String status) {
    Response response = client.get("/api/projects?status=" + status);
    assertThat(response.status()).as("%s 필터 상태 (본문: %s)", status, response.body()).isEqualTo(200);
    List<String> names = new ArrayList<>();
    response.json().forEach(item -> names.add(item.get("name").asText()));
    return names;
  }

  @Test
  void detail() {
    ApiClient client = manager();
    Map<String, Long> ids = idByName();

    Response alpha = client.get("/api/projects/" + ids.get("알파 프로젝트"));
    assertThat(alpha.status()).as("알파 상세 상태 (본문: %s)", alpha.body()).isEqualTo(200);
    JsonNode body = alpha.json();
    assertThat(body.get("name").asText()).isEqualTo("알파 프로젝트");
    assertThat(body.get("description").asText()).isEqualTo("사내 포털 리뉴얼");
    assertThat(body.get("status").asText()).isEqualTo("IN_PROGRESS");
    assertThat(body.get("startDate").asText()).isEqualTo("2026-05-16");
    assertThat(body.get("endDate").asText()).isEqualTo("2026-09-13");
    assertThat(body.get("requiredSkills")).hasSize(1);
    JsonNode line = body.get("requiredSkills").get(0);
    assertThat(line.get("jobTitle").asText()).isEqualTo("백엔드 개발자");
    assertThat(line.get("skillName").asText()).isEqualTo("Java");
    assertThat(line.get("proficiencyLevel").asText()).isEqualTo("INTERMEDIATE");
    assertThat(line.get("headcount").asInt()).isEqualTo(2);
    assertThat(body.get("requiredHeadcount").asInt()).isEqualTo(2);
    assertThat(body.get("assignedHeadcount").asInt()).isEqualTo(3);
    assertAssignments(
        body.get("assignments"),
        new Row("권지안", "2026-05-18", "2026-09-08", 45, 55),
        new Row("강민재", "2026-05-21", "2026-09-03", 40, 60),
        new Row("박소영", "2026-05-26", "2026-07-25", 60, 40));

    Response gamma = client.get("/api/projects/" + ids.get("감마 프로젝트"));
    assertThat(gamma.status()).as("감마 상세 상태 (본문: %s)", gamma.body()).isEqualTo(200);
    JsonNode ended = gamma.json();
    assertThat(ended.get("assignedHeadcount").asInt()).isEqualTo(0);
    assertAssignments(
        ended.get("assignments"),
        new Row("윤서아", "2025-10-18", "2026-02-25", 50, 100),
        new Row("황서윤", "2025-10-28", "2026-02-15", 35, 100),
        new Row("박소영", "2025-11-27", "2026-01-16", 30, 40));
  }

  private record Row(
      String employeeName, String startDate, String endDate, int percent, int availability) {}

  private void assertAssignments(JsonNode assignments, Row... rows) {
    assertThat(assignments).hasSize(rows.length);
    for (int i = 0; i < rows.length; i += 1) {
      JsonNode item = assignments.get(i);
      Row row = rows[i];
      String who = row.employeeName();
      assertThat(item.get("employeeName").asText()).as("%d번째 직원", i).isEqualTo(who);
      assertThat(item.get("startDate").asText()).as("%s 시작일", who).isEqualTo(row.startDate());
      assertThat(item.get("endDate").asText()).as("%s 종료일", who).isEqualTo(row.endDate());
      assertThat(item.get("allocationPercent").asInt()).as("%s 투입률", who).isEqualTo(row.percent());
      assertThat(item.get("currentAvailability").asInt())
          .as("%s 현재 가용률", who)
          .isEqualTo(row.availability());
      assertThat(item.get("assignmentId").asLong()).isPositive();
      assertThat(item.get("employeeId").asLong()).isPositive();
    }
  }

  @Test
  void detailNotFound() {
    Response response = manager().get("/api/projects/99999");

    assertApiError(response, 404, "PROJECT_NOT_FOUND");
    assertThat(response.json().get("message").asText()).isEqualTo("프로젝트를 찾을 수 없습니다.");
  }
}
