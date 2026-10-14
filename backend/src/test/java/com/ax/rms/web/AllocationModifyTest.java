package com.ax.rms.web;

import static com.ax.rms.web.AllocationTestSupport.employeeIdByName;
import static com.ax.rms.web.AllocationTestSupport.manager;
import static com.ax.rms.web.AllocationTestSupport.patch;
import static com.ax.rms.web.AllocationTestSupport.projectIdByName;
import static org.assertj.core.api.Assertions.assertThat;

import com.ax.rms.domain.Assignment;
import com.ax.rms.support.AbstractApiTest;
import com.ax.rms.support.ApiClient;
import com.ax.rms.support.ApiClient.Response;
import java.time.LocalDate;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;

/**
 * T#10 기준 9·10·11: 투입률·기간 수정의 D14·D28·D8·D27 경로. 한 클래스가 한 임시 DB를 쓰므로, 시드의 E1 P1 60%에
 * 기대는 {@code businessRules}가 그 배치를 40으로 낮추는 {@code lowerPercent}보다 먼저 돌도록 순서를 고정한다.
 */
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
class AllocationModifyTest extends AbstractApiTest {

  private ApiClient client;

  @BeforeEach
  void login() {
    client = manager(this);
  }

  @Test
  @Order(2)
  void lowerPercent() {
    long e1 = employeeIdByName(this, "박소영");
    long p1 = projectIdByName(this, "알파 프로젝트");
    long id =
        this.assignmentRepository().findByEmployeeId(e1).stream()
            .filter(a -> a.projectId() == p1)
            .map(a -> a.id())
            .findFirst()
            .orElseThrow();
    Response ok = patch(client, id, "{\"allocationPercent\": 40}");
    assertThat(ok.status()).isEqualTo(200);
    assertThat(ok.json().get("allocationPercent").asInt()).isEqualTo(40);
    Response bad = patch(client, id, "{\"allocationPercent\": 7}");
    assertThat(bad.status()).isEqualTo(400);
    assertThat(bad.json().get("code").asText()).isEqualTo("ASSIGNMENT_INVALID_PERCENT");
  }

  @Test
  @Order(3)
  void unavailableRules() {
    long e2 = employeeIdByName(this, "최동훈");
    long p3 = projectIdByName(this, "베타 프로젝트");
    long id =
        this.assignmentRepository().findByEmployeeId(e2).stream()
            .filter(a -> a.projectId() == p3)
            .map(a -> a.id())
            .findFirst()
            .orElseThrow();
    Response raised = patch(client, id, "{\"allocationPercent\": 45}");
    assertThat(raised.status()).isEqualTo(400);
    assertThat(raised.json().get("code").asText())
        .isEqualTo("ASSIGNMENT_MODIFY_FORBIDDEN_UNAVAILABLE");
    Response lowered = patch(client, id, "{\"allocationPercent\": 20}");
    assertThat(lowered.status()).isEqualTo(200);
  }

  @Test
  @Order(1)
  void businessRules() {
    long e1 = employeeIdByName(this, "박소영");
    long e3 = employeeIdByName(this, "이수민");
    long p3 = projectIdByName(this, "베타 프로젝트");
    long p4 = projectIdByName(this, "델타 프로젝트");

    // 준비는 저장소로 바로 넣는다: 기능 전에도 준비가 성공해, 실패는 각 PATCH 규칙 단언에서 난다.
    long first = insert(e1, p3, FIXED_TODAY, FIXED_TODAY.plusDays(10), 30);
    Response over = patch(client, first, "{\"allocationPercent\": 50}");
    assertThat(over.status()).as("over-allocated status").isEqualTo(400);
    assertThat(over.json().path("code").asText()).isEqualTo("ASSIGNMENT_OVER_ALLOCATED");
    // 뒤의 겹침 서브케이스와 겹치지 않게 first를 없앤다.
    this.assignmentRepository().delete(first);

    long second = insert(e3, p4, LocalDate.of(2026, 7, 15), LocalDate.of(2026, 8, 15), 30);
    Response outOfPeriod =
        patch(client, second, "{\"startDate\": \"2026-10-14\", \"endDate\": \"2026-10-20\"}");
    assertThat(outOfPeriod.status()).as("out-of-period status").isEqualTo(400);
    assertThat(outOfPeriod.json().path("code").asText())
        .isEqualTo("ASSIGNMENT_OUT_OF_PROJECT_PERIOD");

    insert(e1, p3, LocalDate.of(2026, 6, 1), LocalDate.of(2026, 6, 10), 20);
    long fourth = insert(e1, p3, LocalDate.of(2026, 6, 15), LocalDate.of(2026, 6, 25), 20);
    Response overlap =
        patch(client, fourth, "{\"startDate\": \"2026-06-05\", \"endDate\": \"2026-06-20\"}");
    assertThat(overlap.status()).as("overlap status").isEqualTo(400);
    assertThat(overlap.json().path("code").asText()).isEqualTo("ASSIGNMENT_OVERLAP");
  }

  @Test
  @Order(4)
  void invertedPeriodIsRejectedAndNothingChanges() {
    long e3 = employeeIdByName(this, "이수민");
    long p4 = projectIdByName(this, "델타 프로젝트");
    long id = insert(e3, p4, LocalDate.of(2026, 8, 20), LocalDate.of(2026, 8, 31), 30);
    Response inverted =
        patch(client, id, "{\"startDate\": \"2026-08-25\", \"endDate\": \"2026-08-21\"}");
    assertThat(inverted.status()).as("inverted status").isEqualTo(400);
    assertThat(inverted.json().path("code").asText()).isEqualTo("ASSIGNMENT_REQUEST_INVALID");
    Assignment stored = this.assignmentRepository().findById(id).orElseThrow();
    assertThat(stored.startDate()).isEqualTo(LocalDate.of(2026, 8, 20));
    assertThat(stored.endDate()).isEqualTo(LocalDate.of(2026, 8, 31));
  }

  private long insert(
      long employeeId, long projectId, LocalDate start, LocalDate end, int percent) {
    return this.assignmentRepository()
        .insert(new Assignment(null, employeeId, projectId, start, end, percent))
        .id();
  }
}
