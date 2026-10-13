package com.ax.rms.availability;

import com.ax.rms.domain.Assignment;
import com.ax.rms.domain.AvailabilityStatus;
import com.ax.rms.domain.Project;
import com.ax.rms.domain.ProjectStatus;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Component;

/**
 * 날짜별 투입률 합계와 가용률을 계산한다(D7, D18, D19). 계산 자체는 DB나 Spring 컨텍스트에 의존하지 않는다 —
 * 빈으로 등록해 다른 빈에 주입할 수 있게만 한다(T#8부터 {@code EmployeeService}가 주입받아 쓴다).
 */
@Component
public class AvailabilityCalculator {

  /** {@code day}가 기간 안인 배정들의 투입률 합을 돌려준다(종료 여부와 무관). */
  public int dailyTotal(List<Assignment> assignments, LocalDate day) {
    return assignments.stream()
        .filter(a -> !day.isBefore(a.startDate()) && !day.isAfter(a.endDate()))
        .mapToInt(Assignment::allocationPercent)
        .sum();
  }

  /** {@code rangeStart}부터 {@code rangeEnd}까지 중 가장 낮은 날의 가용률을 돌려준다. */
  public int periodAvailability(
      List<Assignment> assignments, LocalDate rangeStart, LocalDate rangeEnd) {
    int lowest = 100;
    for (LocalDate day = rangeStart; !day.isAfter(rangeEnd); day = day.plusDays(1)) {
      int availability = 100 - dailyTotal(assignments, day);
      if (availability < lowest) {
        lowest = availability;
      }
    }
    return lowest;
  }

  /** 프로젝트가 {@code today} 기준으로 종료됐는지(D19) 돌려준다. */
  public boolean isEnded(Project project, LocalDate today) {
    return project.status() == ProjectStatus.DONE || project.endDate().isBefore(today);
  }

  /** 종료된 프로젝트의 배정을 뺀 "오늘" 하루치 가용률을 돌려준다. */
  public int currentAvailability(
      List<Assignment> assignments, Map<Long, Project> projectsById, LocalDate today) {
    List<Assignment> active =
        assignments.stream().filter(a -> !isEnded(projectsById.get(a.projectId()), today)).toList();
    return 100 - dailyTotal(active, today);
  }

  /** 상태가 투입 불가이고, 종료일이 오늘이거나 오늘보다 뒤인 배정이 남아 있으면 확인 필요다(D21). */
  public boolean needsReview(
      AvailabilityStatus status, List<Assignment> assignments, LocalDate today) {
    if (status != AvailabilityStatus.UNAVAILABLE) {
      return false;
    }
    return assignments.stream().anyMatch(a -> !a.endDate().isBefore(today));
  }
}
