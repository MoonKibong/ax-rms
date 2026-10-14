package com.ax.rms.assignment;

import com.ax.rms.availability.AvailabilityCalculator;
import com.ax.rms.domain.Assignment;
import com.ax.rms.domain.AvailabilityStatus;
import com.ax.rms.domain.Employee;
import com.ax.rms.domain.Project;
import com.ax.rms.repository.AssignmentRepository;
import com.ax.rms.repository.EmployeeRepository;
import com.ax.rms.repository.ProjectRepository;
import java.time.LocalDate;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 배치 생성·수정·해제와 후보 조회의 업무 규칙(D8·D14·D27·D28). 위반은 {@link AssignmentRuleException}(400),
 * 없는 리소스는 {@link AssignmentNotFoundException}(404)으로 드러난다.
 */
@Service
public class AssignmentService {

  private static final String REQUEST_INVALID = "ASSIGNMENT_REQUEST_INVALID";
  private static final String INVALID_PERCENT = "ASSIGNMENT_INVALID_PERCENT";
  private static final String EMPLOYEE_NOT_FOUND = "ASSIGNMENT_EMPLOYEE_NOT_FOUND";
  private static final String PROJECT_NOT_FOUND = "ASSIGNMENT_PROJECT_NOT_FOUND";
  private static final String NOT_FOUND = "ASSIGNMENT_NOT_FOUND";
  private static final String EMPLOYEE_UNAVAILABLE = "ASSIGNMENT_EMPLOYEE_UNAVAILABLE";
  private static final String NO_AVAILABILITY = "ASSIGNMENT_NO_AVAILABILITY";
  private static final String OVER_ALLOCATED = "ASSIGNMENT_OVER_ALLOCATED";
  private static final String OUT_OF_PROJECT_PERIOD = "ASSIGNMENT_OUT_OF_PROJECT_PERIOD";
  private static final String OVERLAP = "ASSIGNMENT_OVERLAP";
  private static final String MODIFY_FORBIDDEN = "ASSIGNMENT_MODIFY_FORBIDDEN";
  private static final String MODIFY_FORBIDDEN_SUFFIX = "_UNAVAILABLE";

  private final AssignmentRepository assignments;
  private final EmployeeRepository employees;
  private final ProjectRepository projects;
  private final AvailabilityCalculator calculator = new AvailabilityCalculator();

  /** 주어진 저장소로 만든다. */
  public AssignmentService(
      AssignmentRepository assignments,
      EmployeeRepository employees,
      ProjectRepository projects) {
    this.assignments = assignments;
    this.employees = employees;
    this.projects = projects;
  }

  /** 새 배치를 검증(기간 형식·D14·존재·D8·D27 순)하고 저장한다. */
  @Transactional
  public Assignment create(
      long employeeId, long projectId, LocalDate start, LocalDate end, int percent) {
    requireValidPeriod(start, end);
    requireValidPercent(percent);
    Employee employee = findEmployee(employeeId);
    final Project project = findProject(projectId);
    if (employee.availabilityStatus() == AvailabilityStatus.UNAVAILABLE) {
      throw new AssignmentRuleException(
          EMPLOYEE_UNAVAILABLE, "투입 불가 직원은 새 배치를 받을 수 없습니다.");
    }
    List<Assignment> existing = assignments.findByEmployeeId(employeeId);
    if (calculator.periodAvailability(existing, start, end) == 0) {
      throw new AssignmentRuleException(NO_AVAILABILITY, "대상 기간에 가용률이 0%입니다.");
    }
    checkOverAllocated(existing, start, end, percent);
    checkWithinProjectPeriod(project, start, end);
    checkOverlap(existing, projectId, start, end);
    return assignments.insert(new Assignment(null, employeeId, projectId, start, end, percent));
  }

  /**
   * 배치를 부분 수정한다. 준 값만 바꾼 "수정 후" 상태에 D14·D28·D8(자기 자신 제외)·D27(자기 자신 제외)을
   * 적용하고 저장한다.
   */
  @Transactional
  public Assignment modify(long id, Integer percent, LocalDate start, LocalDate end) {
    Assignment current =
        assignments.findById(id).orElseThrow(AssignmentService::notFound);
    int newPercent = percent == null ? current.allocationPercent() : percent;
    LocalDate newStart = start == null ? current.startDate() : start;
    LocalDate newEnd = end == null ? current.endDate() : end;
    requireValidPeriod(newStart, newEnd);
    if (percent != null) {
      requireValidPercent(percent);
    }
    Employee employee = findEmployee(current.employeeId());
    boolean expanded =
        newPercent > current.allocationPercent()
            || newStart.isBefore(current.startDate())
            || newEnd.isAfter(current.endDate());
    if (employee.availabilityStatus() == AvailabilityStatus.UNAVAILABLE && expanded) {
      throw new AssignmentRuleException(
          MODIFY_FORBIDDEN + MODIFY_FORBIDDEN_SUFFIX,
          "투입 불가 직원은 투입률 하향·기간 축소·해제만 가능합니다.");
    }
    List<Assignment> others =
        assignments.findByEmployeeId(current.employeeId()).stream()
            .filter(a -> !a.id().equals(current.id()))
            .toList();
    checkOverAllocated(others, newStart, newEnd, newPercent);
    checkWithinProjectPeriod(findProject(current.projectId()), newStart, newEnd);
    checkOverlap(others, current.projectId(), newStart, newEnd);
    Assignment updated =
        new Assignment(
            current.id(), current.employeeId(), current.projectId(), newStart, newEnd, newPercent);
    assignments.update(updated);
    return updated;
  }

  /** 배치를 해제한다. */
  @Transactional
  public void release(long id) {
    assignments.findById(id).orElseThrow(AssignmentService::notFound);
    assignments.delete(id);
  }

  /** 기간의 후보 직원 목록을 돌려준다. 가용률은 T#7의 {@code periodAvailability}(D18)다. */
  public List<Candidate> candidates(long projectId, LocalDate start, LocalDate end) {
    requireValidPeriod(start, end);
    findProject(projectId);
    return employees.findAll().stream()
        .map(
            employee ->
                new Candidate(
                    employee.id(),
                    employee.name(),
                    employee.availabilityStatus().name(),
                    calculator.periodAvailability(
                        assignments.findByEmployeeId(employee.id()), start, end)))
        .toList();
  }

  /** 후보 직원 한 명. */
  public record Candidate(
      long employeeId, String name, String availabilityStatus, int periodAvailability) {}

  /**
   * 기간 형식: 시작일과 종료일이 모두 있고 시작일이 종료일보다 늦지 않아야 한다. 업무 규칙(D14·D8·D27)보다 먼저 본다.
   * 역전된 기간은 날짜별 합계 검사를 건너뛰어 저장될 수 있으므로 여기서 막는다.
   */
  private static void requireValidPeriod(LocalDate start, LocalDate end) {
    if (start == null || end == null) {
      throw new AssignmentRuleException(REQUEST_INVALID, "시작일과 종료일을 입력하세요.");
    }
    if (start.isAfter(end)) {
      throw new AssignmentRuleException(REQUEST_INVALID, "시작일은 종료일보다 늦을 수 없습니다.");
    }
  }

  /** D14: 5~100의 5 단위가 아니면 위반이다. */
  private static void requireValidPercent(int percent) {
    if (percent < 5 || percent > 100 || percent % 5 != 0) {
      throw new AssignmentRuleException(
          INVALID_PERCENT, "투입률은 5~100의 5 단위로 입력하세요.");
    }
  }

  private Employee findEmployee(long employeeId) {
    return employees.findById(employeeId)
        .orElseThrow(
            () ->
                new AssignmentNotFoundException(
                    EMPLOYEE_NOT_FOUND, "직원을 찾을 수 없습니다."));
  }

  private Project findProject(long projectId) {
    return projects.findById(projectId)
        .orElseThrow(
            () ->
                new AssignmentNotFoundException(
                    PROJECT_NOT_FOUND, "프로젝트를 찾을 수 없습니다."));
  }

  private static AssignmentNotFoundException notFound() {
    return new AssignmentNotFoundException(NOT_FOUND, "배치를 찾을 수 없습니다.");
  }

  /** D8: 대상 기간의 어느 날도 합계가 100%를 넘으면 위반이다. */
  private void checkOverAllocated(
      List<Assignment> assignments, LocalDate start, LocalDate end, int percent) {
    for (LocalDate day = start; !day.isAfter(end); day = day.plusDays(1)) {
      if (this.calculator.dailyTotal(assignments, day) + percent > 100) {
        throw new AssignmentRuleException(
            OVER_ALLOCATED, "대상 기간에 투입률 합계가 100%를 초과합니다.");
      }
    }
  }

  /** D8: 배치 기간은 프로젝트 기간 안에 있어야 한다. */
  private static void checkWithinProjectPeriod(Project project, LocalDate start, LocalDate end) {
    if (start.isBefore(project.startDate()) || end.isAfter(project.endDate())) {
      throw new AssignmentRuleException(
          OUT_OF_PROJECT_PERIOD, "배치 기간은 프로젝트 기간 안에 있어야 합니다.");
    }
  }

  /** D27: 같은 직원·같은 프로젝트에 기간이 겹치면 위반이다. */
  private static void checkOverlap(
      List<Assignment> assignments, long projectId, LocalDate start, LocalDate end) {
    for (Assignment other : assignments) {
      if (other.projectId() == projectId
          && !end.isBefore(other.startDate())
          && !start.isAfter(other.endDate())) {
        throw new AssignmentRuleException(OVERLAP, "같은 프로젝트에 기간이 겹치는 배치가 있습니다.");
      }
    }
  }
}
