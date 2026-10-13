package com.ax.rms.seed;

import static org.assertj.core.api.Assertions.assertThat;

import com.ax.rms.domain.Assignment;
import com.ax.rms.domain.Project;
import com.ax.rms.repository.AssignmentRepository;
import com.ax.rms.repository.ProjectRepository;
import com.ax.rms.support.AbstractSeedTest;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.TreeSet;
import java.util.stream.Collectors;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/** 시드 전체(15건)가 D8(프로젝트 기간 안, 일별 100% 이하)과 D27(겹침 없음)을 지키는지 본다. */
class SeedBusinessRuleTest extends AbstractSeedTest {

  @Autowired private AssignmentRepository assignmentRepository;
  @Autowired private ProjectRepository projectRepository;

  @Test
  void everySeedAssignmentFollowsD8AndD27() {
    List<Assignment> assignments = assignmentRepository.findAll();
    // 전제: 시더가 없으면 배치가 0건이라 아래 검사들이 "대상 없음"으로 공허하게 통과해 버린다. 그래서 먼저
    // 배치가 실제로 존재하는지부터 확인한다.
    assertThat(assignments).isNotEmpty();

    Map<Long, Project> projectsById =
        projectRepository.findAll().stream().collect(Collectors.toMap(Project::id, p -> p));

    for (Assignment assignment : assignments) {
      Project project = projectsById.get(assignment.projectId());
      assertThat(project).as("assignment %s의 프로젝트", assignment.id()).isNotNull();
      assertThat(assignment.startDate())
          .as("assignment %s가 프로젝트 기간 시작 안에 있다", assignment.id())
          .isAfterOrEqualTo(project.startDate());
      assertThat(assignment.endDate())
          .as("assignment %s가 프로젝트 기간 끝 안에 있다", assignment.id())
          .isBeforeOrEqualTo(project.endDate());
    }

    Map<Long, List<Assignment>> byEmployee =
        assignments.stream().collect(Collectors.groupingBy(Assignment::employeeId));
    for (Map.Entry<Long, List<Assignment>> entry : byEmployee.entrySet()) {
      assertDailyTotalNeverExceeds100(entry.getKey(), entry.getValue());
    }

    Map<String, List<Assignment>> byEmployeeAndProject =
        assignments.stream()
            .collect(Collectors.groupingBy(a -> a.employeeId() + ":" + a.projectId()));
    for (Map.Entry<String, List<Assignment>> entry : byEmployeeAndProject.entrySet()) {
      List<Assignment> group = entry.getValue();
      for (int i = 0; i < group.size(); i++) {
        for (int j = i + 1; j < group.size(); j++) {
          assertThat(overlaps(group.get(i), group.get(j)))
              .as(
                  "%s의 두 배치(%s, %s)는 겹치지 않아야 한다",
                  entry.getKey(), group.get(i).id(), group.get(j).id())
              .isFalse();
        }
      }
    }
  }

  private void assertDailyTotalNeverExceeds100(
      long employeeId, List<Assignment> employeeAssignments) {
    TreeSet<LocalDate> boundaries = new TreeSet<>();
    for (Assignment a : employeeAssignments) {
      boundaries.add(a.startDate());
      boundaries.add(a.endDate());
    }
    for (LocalDate day : boundaries) {
      int total =
          employeeAssignments.stream()
              .filter(a -> !day.isBefore(a.startDate()) && !day.isAfter(a.endDate()))
              .mapToInt(Assignment::allocationPercent)
              .sum();
      assertThat(total).as("직원 %s의 %s 총투입률", employeeId, day).isLessThanOrEqualTo(100);
    }
  }

  private boolean overlaps(Assignment a, Assignment b) {
    return !a.startDate().isAfter(b.endDate()) && !b.startDate().isAfter(a.endDate());
  }
}
