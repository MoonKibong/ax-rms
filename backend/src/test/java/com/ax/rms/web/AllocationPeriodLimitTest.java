package com.ax.rms.web;

import static com.ax.rms.web.AllocationTestSupport.candidates;
import static com.ax.rms.web.AllocationTestSupport.create;
import static com.ax.rms.web.AllocationTestSupport.created;
import static com.ax.rms.web.AllocationTestSupport.employeeIdByName;
import static com.ax.rms.web.AllocationTestSupport.manager;
import static com.ax.rms.web.AllocationTestSupport.patch;
import static com.ax.rms.web.AllocationTestSupport.projectIdByName;
import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertTimeoutPreemptively;

import com.ax.rms.domain.Project;
import com.ax.rms.domain.ProjectStatus;
import com.ax.rms.support.AbstractApiTest;
import com.ax.rms.support.ApiClient;
import com.ax.rms.support.ApiClient.Response;
import java.time.Duration;
import java.time.LocalDate;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

/** T#53 기준 1~5: 배치 기간은 366일(시작일·종료일 포함)까지, 날짜 반복 전에 거절한다. */
class AllocationPeriodLimitTest extends AbstractApiTest {

  private static final String TOO_LONG = "ASSIGNMENT_PERIOD_TOO_LONG";
  private static final LocalDate FIRST = LocalDate.of(2026, 1, 1);
  private static final LocalDate DAY_366 = LocalDate.of(2027, 1, 1);
  private static final LocalDate DAY_367 = LocalDate.of(2027, 1, 2);
  private static final Duration FAST = Duration.ofSeconds(2);

  private ApiClient client;
  private long longProject;
  private long e3;

  @BeforeEach
  void setUp() {
    client = manager(this);
    e3 = employeeIdByName(this, "이수민");
    longProject =
        projectRepository()
            .insert(
                new Project(
                    null, "긴 프로젝트", null, FIRST, LocalDate.of(2027, 12, 31), ProjectStatus.IN_PROGRESS))
            .id();
  }

  private static void assertTooLong(Response response) {
    assertThat(response.status()).as("status").isEqualTo(400);
    assertThat(response.json().path("code").asText()).isEqualTo(TOO_LONG);
  }

  @Test
  void createBoundary() {
    long before = assignmentRepository().count();
    Response ok = create(client, e3, longProject, FIRST, DAY_366, 20);
    assertThat(ok.status()).as("366 days").isEqualTo(201);
    Response tooLong = create(client, e3, longProject, FIRST, DAY_367, 20);
    assertTooLong(tooLong);
    assertThat(assignmentRepository().count()).isEqualTo(before + 1);
  }

  @Test
  void extremePeriodIsRejectedFast() {
    long before = assignmentRepository().count();
    Response response =
        assertTimeoutPreemptively(
            FAST,
            () ->
                create(
                    client,
                    e3,
                    longProject,
                    LocalDate.of(1, 1, 1),
                    LocalDate.of(9999, 12, 31),
                    20));
    assertTooLong(response);
    assertThat(assignmentRepository().count()).isEqualTo(before);
  }

  @Test
  void modifyChecksResultingPeriod() {
    long id = created(client, e3, longProject, FIRST, DAY_366, 20);
    Response longer = patch(client, id, "{\"endDate\": \"" + DAY_367 + "\"}");
    assertTooLong(longer);
    assertThat(assignmentRepository().findById(id).orElseThrow().endDate()).isEqualTo(DAY_366);
    Response percentOnly = patch(client, id, "{\"allocationPercent\": 30}");
    assertThat(percentOnly.status()).isEqualTo(200);
  }

  @Test
  void candidatesBoundary() {
    long p3 = projectIdByName(this, "베타 프로젝트");
    assertThat(candidates(client, p3, FIRST, DAY_366).status()).isEqualTo(200);
    assertTooLong(candidates(client, p3, FIRST, DAY_367));
    Response extreme =
        assertTimeoutPreemptively(
            FAST, () -> candidates(client, p3, LocalDate.of(1, 1, 1), LocalDate.of(9999, 12, 31)));
    assertTooLong(extreme);
  }

  @Test
  void priority() {
    Response inverted = create(client, e3, longProject, DAY_367, FIRST, 20);
    assertThat(inverted.json().path("code").asText()).isEqualTo("ASSIGNMENT_REQUEST_INVALID");
    Response percent = create(client, e3, longProject, FIRST, DAY_367, 7);
    assertTooLong(percent);
    Response missingEmployee = create(client, 999_999L, longProject, FIRST, DAY_367, 20);
    assertTooLong(missingEmployee);
  }
}
