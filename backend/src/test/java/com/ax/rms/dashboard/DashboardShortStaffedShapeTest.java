package com.ax.rms.dashboard;

import static org.assertj.core.api.Assertions.assertThat;

import com.ax.rms.domain.Assignment;
import com.ax.rms.support.AbstractApiTest;
import com.ax.rms.support.ApiClient;
import com.ax.rms.support.ApiClient.Response;
import com.fasterxml.jackson.databind.JsonNode;
import java.util.List;
import org.junit.jupiter.api.Test;

/**
 * T#11 기준 3: 인력 부족 항목의 모양. 배정을 바꾸므로 시드를 읽는 {@link DashboardApiTest}와 클래스를 나눠, 검사마다
 * 새 DB 컨텍스트가 아니라 클래스 단위로 격리한다(이 클래스에는 검사가 하나뿐이다).
 */
class DashboardShortStaffedShapeTest extends AbstractApiTest {

  @Test
  void shortStaffedShape() {
    long alpha = projectIdByName("알파 프로젝트");
    List<Assignment> todays =
        this.assignmentRepository()
            .findByProjectId(alpha)
            .stream()
            .filter(a -> !FIXED_TODAY.isBefore(a.startDate()) && !FIXED_TODAY.isAfter(a.endDate()))
            .toList();
    assertThat(todays).as("알파의 오늘 배치").isNotEmpty();
    for (Assignment a : todays) {
      this.assignmentRepository().delete(a.id());
    }
    long imdoyoon = employeeIdByName("임도윤");
    this.assignmentRepository()
        .insert(
            new Assignment(
                null, imdoyoon, alpha, FIXED_TODAY.minusDays(1), FIXED_TODAY.plusDays(1), 20));

    ApiClient client = this.client();
    assertThat(client.login("project.manager", "ProjectManager!1").status()).as("로그인 상태").isEqualTo(200);
    Response response = client.get("/api/dashboard");
    assertThat(response.status()).as("대시보드 상태").isEqualTo(200);
    JsonNode body = response.json();
    JsonNode shortStaffed = body.path("shortStaffedProjects");
    assertThat(shortStaffed.size()).as("인력 부족 프로젝트 수").isEqualTo(1);
    JsonNode entry = shortStaffed.get(0);
    assertThat(entry.path("id").asLong()).isEqualTo(alpha);
    assertThat(entry.path("name").asText()).isEqualTo("알파 프로젝트");
    assertThat(entry.path("requiredHeadcount").asInt()).isEqualTo(2);
    assertThat(entry.path("assignedHeadcount").asInt()).isEqualTo(1);
    JsonNode missing = entry.path("missingSkills");
    assertThat(missing.size()).isEqualTo(1);
    assertThat(missing.get(0).path("skill").asText()).isEqualTo("Java");
    assertThat(missing.get(0).path("requiredHeadcount").asInt()).isEqualTo(2);
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
}
