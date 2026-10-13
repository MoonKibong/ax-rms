package com.ax.rms.seed;

import static org.assertj.core.api.Assertions.assertThat;

import com.ax.rms.domain.Assignment;
import com.ax.rms.domain.AvailabilityStatus;
import com.ax.rms.domain.Employee;
import com.ax.rms.domain.Project;
import com.ax.rms.domain.ProjectStatus;
import com.ax.rms.repository.AssignmentRepository;
import com.ax.rms.repository.EmployeeRepository;
import com.ax.rms.repository.ProjectRepository;
import com.ax.rms.support.AbstractSeedTest;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/** §7 시나리오를 바로 재현할 수 있는 시드 행이 있는지 본다(기준 7의 (a)(b)(c)). */
class ScenarioDataTest extends AbstractSeedTest {

  @Autowired private EmployeeRepository employeeRepository;
  @Autowired private ProjectRepository projectRepository;
  @Autowired private AssignmentRepository assignmentRepository;

  @Test
  void hasAnEmployeeWithA60PercentAssignmentCoveringTodayOnAnInProgressProject() {
    Assignment a = findAssignment(60).orElseThrow(() -> new AssertionError("60% 배치가 시드에 없다"));
    LocalDate today = AbstractSeedTest.FIXED_TODAY;
    assertThat(a.startDate()).isBeforeOrEqualTo(today);
    assertThat(a.endDate()).isAfterOrEqualTo(today);

    Project project = projectRepository.findById(a.projectId()).orElseThrow();
    assertThat(project.status()).isEqualTo(ProjectStatus.IN_PROGRESS);
    assertThat(project.startDate()).isBeforeOrEqualTo(today);
    assertThat(project.endDate()).isAfterOrEqualTo(today);
  }

  @Test
  void hasAnUnavailableEmployeeWithAnActiveAssignmentNeedingAttention() {
    LocalDate today = AbstractSeedTest.FIXED_TODAY;
    List<Employee> unavailable =
        employeeRepository.findAll().stream()
            .filter(e -> e.availabilityStatus() == AvailabilityStatus.UNAVAILABLE)
            .filter(e -> e.unavailableUntil() != null && e.unavailableUntil().isAfter(today))
            .toList();
    assertThat(unavailable).isNotEmpty();

    Employee employee = unavailable.get(0);
    List<Assignment> assignments = assignmentRepository.findByEmployeeId(employee.id());
    List<Assignment> stillOpen =
        assignments.stream().filter(a -> a.endDate().isAfter(today)).toList();
    assertThat(stillOpen).as("확인 필요 조건: 투입 불가 + 종료일이 오늘 이후인 배정").isNotEmpty();

    Project project = projectRepository.findById(stillOpen.get(0).projectId()).orElseThrow();
    assertThat(project.status()).isEqualTo(ProjectStatus.IN_PROGRESS);
    assertThat(project.startDate()).isBeforeOrEqualTo(today);
    assertThat(project.endDate()).isAfterOrEqualTo(today);
  }

  @Test
  void hasTwoNonOverlappingAssignmentsOnDifferentProjectsForTheSameEmployee() {
    Assignment a60 = findAssignment(60).orElseThrow(() -> new AssertionError("60% 배치가 시드에 없다"));
    List<Assignment> sameEmployee = assignmentRepository.findByEmployeeId(a60.employeeId());

    List<Assignment> others =
        sameEmployee.stream()
            .filter(a -> !a.id().equals(a60.id()))
            .filter(a -> a.projectId() != a60.projectId())
            .filter(a -> !overlaps(a, a60))
            .toList();
    assertThat(others).as("같은 직원의, 60%% 배치와 겹치지 않는 다른 프로젝트 배치").isNotEmpty();
  }

  private Optional<Assignment> findAssignment(int allocationPercent) {
    return assignmentRepository.findAll().stream()
        .filter(a -> a.allocationPercent() == allocationPercent)
        .findFirst();
  }

  private boolean overlaps(Assignment a, Assignment b) {
    return !a.startDate().isAfter(b.endDate()) && !b.startDate().isAfter(a.endDate());
  }
}
