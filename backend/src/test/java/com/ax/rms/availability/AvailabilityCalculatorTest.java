package com.ax.rms.availability;

import static org.assertj.core.api.Assertions.assertThat;

import com.ax.rms.domain.Assignment;
import com.ax.rms.domain.AvailabilityStatus;
import com.ax.rms.domain.Project;
import com.ax.rms.domain.ProjectStatus;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class AvailabilityCalculatorTest {

  private final AvailabilityCalculator calculator = new AvailabilityCalculator();

  @Test
  void overlappingAssignmentsAreSummedOnTheSameDay() {
    Assignment a = assignment(1, LocalDate.of(2026, 6, 1), LocalDate.of(2026, 6, 30), 40);
    Assignment b = assignment(2, LocalDate.of(2026, 6, 10), LocalDate.of(2026, 6, 20), 35);

    assertThat(calculator.dailyTotal(List.of(a, b), LocalDate.of(2026, 6, 15))).isEqualTo(75);
  }

  @Test
  void nonOverlappingAssignmentsAreNotSummedOnTheSameDay() {
    Assignment a = assignment(1, LocalDate.of(2026, 1, 1), LocalDate.of(2026, 1, 31), 50);
    Assignment c = assignment(2, LocalDate.of(2026, 3, 1), LocalDate.of(2026, 3, 31), 20);

    assertThat(calculator.dailyTotal(List.of(a, c), LocalDate.of(2026, 1, 15))).isEqualTo(50);
  }

  @Test
  void partiallyOverlappingAssignmentsAreSummedOnlyOnTheOverlappingDays() {
    Assignment a = assignment(1, LocalDate.of(2026, 2, 1), LocalDate.of(2026, 2, 20), 30);
    Assignment d = assignment(2, LocalDate.of(2026, 2, 15), LocalDate.of(2026, 2, 28), 40);
    List<Assignment> assignments = List.of(a, d);

    assertThat(calculator.dailyTotal(assignments, LocalDate.of(2026, 2, 10))).isEqualTo(30);
    assertThat(calculator.dailyTotal(assignments, LocalDate.of(2026, 2, 18))).isEqualTo(70);
    assertThat(calculator.dailyTotal(assignments, LocalDate.of(2026, 2, 25))).isEqualTo(40);
  }

  @Test
  void dailyTotalIncludesEndedProjectAssignmentsOnAnEarlierDate() {
    Assignment e1 = assignment(10, LocalDate.of(2026, 1, 1), LocalDate.of(2026, 1, 31), 40);

    assertThat(calculator.dailyTotal(List.of(e1), LocalDate.of(2026, 1, 15))).isEqualTo(40);
  }

  @Test
  void currentAvailabilityExcludesOnlyEndedProjectAssignments() {
    LocalDate today = LocalDate.of(2026, 6, 15);
    Project p1 = project(100, ProjectStatus.DONE, LocalDate.of(2026, 1, 31));
    Project p3 = project(300, ProjectStatus.IN_PROGRESS, LocalDate.of(2026, 5, 1));
    Project p4 = project(400, ProjectStatus.IN_PROGRESS, LocalDate.of(2026, 12, 31));
    Assignment e1b = assignment(100, LocalDate.of(2026, 6, 1), LocalDate.of(2026, 6, 30), 40);
    Assignment e3 = assignment(300, LocalDate.of(2026, 6, 1), LocalDate.of(2026, 6, 30), 15);
    Assignment e4 = assignment(400, LocalDate.of(2026, 6, 1), LocalDate.of(2026, 6, 30), 25);
    List<Assignment> assignments = List.of(e1b, e3, e4);
    Map<Long, Project> projectsById = Map.of(100L, p1, 300L, p3, 400L, p4);

    assertThat(calculator.dailyTotal(assignments, today)).isEqualTo(80);
    assertThat(calculator.currentAvailability(assignments, projectsById, today)).isEqualTo(75);
  }

  @Test
  void periodAvailabilityIsTheLowestDayInTheRange() {
    Assignment h = assignment(1, LocalDate.of(2026, 7, 1), LocalDate.of(2026, 7, 10), 20);
    Assignment i = assignment(2, LocalDate.of(2026, 7, 5), LocalDate.of(2026, 7, 8), 50);

    assertThat(
            calculator.periodAvailability(
                List.of(h, i), LocalDate.of(2026, 7, 1), LocalDate.of(2026, 7, 10)))
        .isEqualTo(30);
  }

  @Test
  void weekendsAreCalculatedLikeAnyOtherDay() {
    LocalDate saturday = LocalDate.of(2026, 7, 18);
    assertThat(saturday.getDayOfWeek().toString()).isEqualTo("SATURDAY");
    Assignment k = assignment(1, saturday, saturday, 45);

    assertThat(calculator.dailyTotal(List.of(k), saturday)).isEqualTo(45);
  }

  @Test
  void currentAvailabilityIsTodaysAvailability() {
    LocalDate today = LocalDate.of(2026, 8, 10);
    Project p5 = project(500, ProjectStatus.IN_PROGRESS, LocalDate.of(2026, 12, 31));
    Assignment l = assignment(500, LocalDate.of(2026, 8, 1), LocalDate.of(2026, 8, 20), 40);

    assertThat(calculator.currentAvailability(List.of(l), Map.of(500L, p5), today)).isEqualTo(60);
  }

  @Test
  void sixtyPlusThirtyPercentLeavesTenPercentAvailable() {
    Assignment m = assignment(1, LocalDate.of(2026, 9, 1), LocalDate.of(2026, 9, 30), 60);
    Assignment n = assignment(2, LocalDate.of(2026, 9, 10), LocalDate.of(2026, 9, 20), 30);

    assertThat(
            calculator.periodAvailability(
                List.of(m, n), LocalDate.of(2026, 9, 10), LocalDate.of(2026, 9, 20)))
        .isEqualTo(10);
  }

  @Test
  void unavailableWithAssignmentEndingAfterTodayNeedsReview() {
    LocalDate today = LocalDate.of(2026, 6, 15);
    Assignment future = assignment(1, today.minusDays(5), today.plusDays(16), 40);

    assertThat(calculator.needsReview(AvailabilityStatus.UNAVAILABLE, List.of(future), today))
        .isTrue();
  }

  @Test
  void unavailableWithAssignmentEndingExactlyTodayNeedsReview() {
    LocalDate today = LocalDate.of(2026, 6, 15);
    Assignment endsToday = assignment(1, today.minusDays(10), today, 40);

    assertThat(calculator.needsReview(AvailabilityStatus.UNAVAILABLE, List.of(endsToday), today))
        .isTrue();
  }

  @Test
  void unavailableWithAssignmentAlreadyEndedDoesNotNeedReview() {
    LocalDate today = LocalDate.of(2026, 6, 15);
    Assignment ended = assignment(1, today.minusDays(30), today.minusDays(14), 40);

    assertThat(calculator.needsReview(AvailabilityStatus.UNAVAILABLE, List.of(ended), today))
        .isFalse();
  }

  @Test
  void unavailableWithNoAssignmentsDoesNotNeedReview() {
    LocalDate today = LocalDate.of(2026, 6, 15);

    assertThat(calculator.needsReview(AvailabilityStatus.UNAVAILABLE, List.of(), today))
        .isFalse();
  }

  @Test
  void availableWithFutureAssignmentDoesNotNeedReview() {
    LocalDate today = LocalDate.of(2026, 6, 15);
    Assignment future = assignment(1, today.minusDays(5), today.plusDays(200), 40);

    assertThat(calculator.needsReview(AvailabilityStatus.AVAILABLE, List.of(future), today))
        .isFalse();
  }

  private Assignment assignment(
      long projectId, LocalDate startDate, LocalDate endDate, int allocationPercent) {
    return new Assignment(null, 1L, projectId, startDate, endDate, allocationPercent);
  }

  private Project project(long id, ProjectStatus status, LocalDate endDate) {
    return new Project(id, "프로젝트" + id, "", LocalDate.of(2020, 1, 1), endDate, status);
  }
}
