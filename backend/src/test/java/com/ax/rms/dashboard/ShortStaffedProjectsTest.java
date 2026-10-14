package com.ax.rms.dashboard;

import static org.assertj.core.api.Assertions.assertThat;

import com.ax.rms.domain.Assignment;
import com.ax.rms.domain.EmployeeSkill;
import com.ax.rms.domain.ProficiencyLevel;
import com.ax.rms.domain.Project;
import com.ax.rms.domain.ProjectRequiredSkillLine;
import com.ax.rms.domain.ProjectStatus;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.Test;

/**
 * T#11 기준 7: 인력 부족 판정(D20) 단위 검사. 손으로 만든 값으로 시드 없이 판정 로직을 확인한다.
 */
class ShortStaffedProjectsTest {

  private static final LocalDate TODAY = LocalDate.of(2026, 6, 15);

  private static Project project(
      long id, String name, LocalDate start, LocalDate end, ProjectStatus status) {
    return new Project(id, name, "", start, end, status);
  }

  private static Assignment assignment(long id, long employeeId, long projectId, int percent) {
    return new Assignment(
        id, employeeId, projectId, TODAY.minusDays(1), TODAY.plusDays(1), percent);
  }

  private static EmployeeSkill skill(long id, long employeeId, String skillName) {
    return new EmployeeSkill(id, employeeId, skillName, ProficiencyLevel.BEGINNER);
  }

  private static ProjectRequiredSkillLine line(
      long id, long projectId, String skillName, int headcount) {
    return new ProjectRequiredSkillLine(
        id, projectId, "개발자", skillName, ProficiencyLevel.INTERMEDIATE, headcount);
  }

  @Test
  void tooFewAssignedTodayIsShort() {
    Project p1 =
        project(1, "알파", TODAY.minusDays(10), TODAY.plusDays(30), ProjectStatus.IN_PROGRESS);
    List<Long> ids =
        DashboardService.shortStaffedProjectIds(
            List.of(p1),
            List.of(assignment(1L, 1L, 1L, 50)),
            List.of(skill(1L, 1L, "Java")),
            List.of(line(1L, 1L, "Java", 2)),
            TODAY);
    assertThat(ids).containsExactly(1L);
  }

  @Test
  void missingSkillHolderIsShort() {
    Project p1 =
        project(1, "알파", TODAY.minusDays(10), TODAY.plusDays(30), ProjectStatus.IN_PROGRESS);
    List<Long> ids =
        DashboardService.shortStaffedProjectIds(
            List.of(p1),
            List.of(assignment(1L, 1L, 1L, 50)),
            List.of(skill(1L, 2L, "Java")),
            List.of(line(1L, 1L, "Java", 1)),
            TODAY);
    assertThat(ids).containsExactly(1L);
  }

  @Test
  void enoughPeopleAndSkillCoveredIsNotShort() {
    Project p1 =
        project(1, "알파", TODAY.minusDays(10), TODAY.plusDays(30), ProjectStatus.IN_PROGRESS);
    List<Long> ids =
        DashboardService.shortStaffedProjectIds(
            List.of(p1),
            List.of(assignment(1L, 1L, 1L, 50)),
            List.of(skill(1L, 1L, "Java")),
            List.of(line(1L, 1L, "Java", 1)),
            TODAY);
    assertThat(ids).isEmpty();
  }

  @Test
  void nonInProgressProjectsAreIgnored() {
    Project done = project(1, "감마", TODAY.minusDays(10), TODAY.plusDays(30), ProjectStatus.DONE);
    Project planned =
        project(2, "델타", TODAY.minusDays(10), TODAY.plusDays(30), ProjectStatus.PLANNED);
    Project onHold =
        project(3, "엡실론", TODAY.minusDays(10), TODAY.plusDays(30), ProjectStatus.ON_HOLD);
    List<Long> ids =
        DashboardService.shortStaffedProjectIds(
            List.of(done, planned, onHold),
            List.of(),
            List.of(),
            List.of(line(1L, 1L, "Java", 2), line(2L, 2L, "Java", 2), line(3L, 3L, "Java", 2)),
            TODAY);
    assertThat(ids).isEmpty();
  }
}
