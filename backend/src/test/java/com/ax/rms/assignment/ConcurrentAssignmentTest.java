package com.ax.rms.assignment;

import static org.assertj.core.api.Assertions.assertThat;

import com.ax.rms.domain.Assignment;
import com.ax.rms.domain.AvailabilityStatus;
import com.ax.rms.domain.Employee;
import com.ax.rms.domain.Project;
import com.ax.rms.repository.AssignmentRepository;
import com.ax.rms.repository.DepartmentRepository;
import com.ax.rms.repository.EmployeeRepository;
import com.ax.rms.repository.ProjectRepository;
import com.ax.rms.support.AbstractSeedTest;
import com.ax.rms.web.ApiException;
import java.time.LocalDate;
import java.util.concurrent.CyclicBarrier;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/**
 * 동시 배치 요청에도 D8(날짜별 투입률 합계 100% 이하) 규칙이 지켜지는지 본다(T#54 기준 5, B#2). 매 반복마다
 * 배치가 없는 새 직원을 만들어, 같은 직원·같은 기간에 60%씩 두 요청을 거의 동시에 보낸다. 타이밍에 의존하므로
 * 10회 반복한다 — 계약서 기준 5대로 그중 한 번이라도 100%를 넘으면 레드다.
 */
class ConcurrentAssignmentTest extends AbstractSeedTest {

  private static final int ITERATIONS = 10;

  @Autowired private AssignmentService assignmentService;
  @Autowired private EmployeeRepository employeeRepository;
  @Autowired private DepartmentRepository departmentRepository;
  @Autowired private ProjectRepository projectRepository;
  @Autowired private AssignmentRepository assignmentRepository;

  @Test
  void concurrentCreatesNeverExceedTheDailyCap() throws Exception {
    long departmentId = departmentRepository.findAll().get(0).id();
    Project project = projectRepository.findAll().get(0);
    LocalDate start = project.startDate().plusDays(1);
    LocalDate end = start.plusDays(5);

    ExecutorService pool = Executors.newFixedThreadPool(2);
    try {
      for (int i = 0; i < ITERATIONS; i++) {
        Employee employee =
            employeeRepository.insert(
                new Employee(
                    null,
                    "T54동시성" + i,
                    departmentId,
                    "개발자",
                    1,
                    AvailabilityStatus.AVAILABLE,
                    null,
                    null));
        CyclicBarrier barrier = new CyclicBarrier(2);
        Future<Outcome> first =
            pool.submit(() -> attemptCreate(barrier, employee.id(), project.id(), start, end, 60));
        Future<Outcome> second =
            pool.submit(() -> attemptCreate(barrier, employee.id(), project.id(), start, end, 60));
        Outcome firstOutcome = first.get(10, TimeUnit.SECONDS);
        Outcome secondOutcome = second.get(10, TimeUnit.SECONDS);

        int successCount =
            (firstOutcome.succeeded ? 1 : 0) + (secondOutcome.succeeded ? 1 : 0);
        int total =
            assignmentRepository.findByEmployeeId(employee.id()).stream()
                .mapToInt(Assignment::allocationPercent)
                .sum();
        String context =
            String.format(
                "%d번째 반복: 직원 %d, 첫 요청=%s, 둘째 요청=%s",
                i, employee.id(), firstOutcome, secondOutcome);

        assertThat(total).as(context).isLessThanOrEqualTo(100);
        if (successCount == 1) {
          Outcome rejected = firstOutcome.succeeded ? secondOutcome : firstOutcome;
          assertThat(rejected.rejectionCode).as(context).isEqualTo("ASSIGNMENT_OVER_ALLOCATED");
        } else {
          assertThat(successCount).as(context).isEqualTo(2);
        }
      }
    } finally {
      pool.shutdownNow();
    }
  }

  private Outcome attemptCreate(
      CyclicBarrier barrier,
      long employeeId,
      long projectId,
      LocalDate start,
      LocalDate end,
      int percent) {
    try {
      barrier.await(5, TimeUnit.SECONDS);
    } catch (Exception e) {
      throw new RuntimeException(e);
    }
    try {
      assignmentService.create(employeeId, projectId, start, end, percent);
      return new Outcome(true, null);
    } catch (ApiException rejected) {
      return new Outcome(false, rejected.code());
    }
  }

  private record Outcome(boolean succeeded, String rejectionCode) {}
}
