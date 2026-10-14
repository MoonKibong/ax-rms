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
 * T#10 §7 시나리오 (d) 기간이 겹치지 않는 배치: P1의 60%를 덮지 않는 기간에 배치하면 합산되지 않는다.
 */
class AllocationScenarioNonOverlapTest extends AbstractApiTest {

  private ApiClient client;

  @BeforeEach
  void login() {
    client = manager(this);
  }

  @Test
  void nonOverlapScenario() {
    long e1 = employeeIdByName(this, "박소영");
    long p4 = projectIdByName(this, "델타 프로젝트");
    LocalDate start = LocalDate.of(2026, 7, 26);
    LocalDate end = LocalDate.of(2026, 8, 15);
    Response response = create(client, e1, p4, start, end, 30);
    assertThat(response.status()).isEqualTo(201);
    int availability =
        this.calculator()
            .periodAvailability(this.assignmentRepository().findByEmployeeId(e1), start, end);
    assertThat(availability).isEqualTo(70);
  }
}
