package com.ax.rms.web;

import static com.ax.rms.web.AllocationTestSupport.create;
import static com.ax.rms.web.AllocationTestSupport.employeeIdByName;
import static com.ax.rms.web.AllocationTestSupport.manager;
import static com.ax.rms.web.AllocationTestSupport.projectIdByName;
import static org.assertj.core.api.Assertions.assertThat;

import com.ax.rms.support.AbstractApiTest;
import com.ax.rms.support.ApiClient;
import com.ax.rms.support.ApiClient.Response;
import java.time.LocalDate;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

/**
 * T#10 기준 1·2·4·5·6·7·8: 배치 생성의 정상·D14·D8·D27 경로.
 */
class AllocationCreateTest extends AbstractApiTest {

  private ApiClient client;

  @BeforeEach
  void login() {
    client = manager(this);
  }

  @Test
  void normalAllocation() {
    long e1 = employeeIdByName(this, "박소영");
    long p3 = projectIdByName(this, "베타 프로젝트");
    Response response = create(client, e1, p3, FIXED_TODAY, FIXED_TODAY.plusDays(10), 30);
    assertThat(response.status()).isEqualTo(201);
    assertThat(response.json().get("allocationPercent").asInt()).isEqualTo(30);
    assertThat(response.json().get("id").isNull()).isFalse();
  }

  @Test
  void invalidPercent() {
    long e1 = employeeIdByName(this, "박소영");
    long p3 = projectIdByName(this, "베타 프로젝트");
    for (int percent : new int[] {0, 3, 7, 105}) {
      Response response = create(client, e1, p3, FIXED_TODAY, FIXED_TODAY.plusDays(10), percent);
      assertThat(response.status()).as("percent=" + percent).isEqualTo(400);
      assertThat(response.json().get("code").asText()).isEqualTo("ASSIGNMENT_INVALID_PERCENT");
    }
  }

  @Test
  void unavailableEmployee() {
    long e2 = employeeIdByName(this, "최동훈");
    long p4 = projectIdByName(this, "델타 프로젝트");
    Response response = create(client, e2, p4, FIXED_TODAY, FIXED_TODAY.plusDays(10), 20);
    assertThat(response.status()).isEqualTo(400);
    assertThat(response.json().get("code").asText()).isEqualTo("ASSIGNMENT_EMPLOYEE_UNAVAILABLE");
  }

  @Test
  void noAvailability() {
    long e3 = employeeIdByName(this, "이수민");
    long p1 = projectIdByName(this, "알파 프로젝트");
    LocalDate start = FIXED_TODAY;
    LocalDate end = FIXED_TODAY.plusDays(5);
    Response first = create(client, e3, p1, start, end, 100);
    assertThat(first.status()).isEqualTo(201);
    Response second = create(client, e3, p1, start, end, 5);
    assertThat(second.status()).isEqualTo(400);
    assertThat(second.json().get("code").asText()).isEqualTo("ASSIGNMENT_NO_AVAILABILITY");
  }

  @Test
  void overAllocated() {
    long e1 = employeeIdByName(this, "박소영");
    long p3 = projectIdByName(this, "베타 프로젝트");
    Response response = create(client, e1, p3, FIXED_TODAY, FIXED_TODAY.plusDays(10), 50);
    assertThat(response.status()).isEqualTo(400);
    assertThat(response.json().get("code").asText()).isEqualTo("ASSIGNMENT_OVER_ALLOCATED");
  }

  @Test
  void outOfProjectPeriod() {
    long e3 = employeeIdByName(this, "이수민");
    long p4 = projectIdByName(this, "델타 프로젝트");
    Response response =
        create(client, e3, p4, LocalDate.of(2026, 10, 14), LocalDate.of(2026, 10, 20), 20);
    assertThat(response.status()).isEqualTo(400);
    assertThat(response.json().get("code").asText()).isEqualTo("ASSIGNMENT_OUT_OF_PROJECT_PERIOD");
  }

  @Test
  void overlap() {
    long e1 = employeeIdByName(this, "박소영");
    long p3 = projectIdByName(this, "베타 프로젝트");
    Response first =
        create(client, e1, p3, LocalDate.of(2026, 6, 1), LocalDate.of(2026, 6, 10), 20);
    assertThat(first.status()).isEqualTo(201);
    Response second =
        create(client, e1, p3, LocalDate.of(2026, 6, 5), LocalDate.of(2026, 6, 20), 20);
    assertThat(second.status()).isEqualTo(400);
    assertThat(second.json().get("code").asText()).isEqualTo("ASSIGNMENT_OVERLAP");
  }
}
