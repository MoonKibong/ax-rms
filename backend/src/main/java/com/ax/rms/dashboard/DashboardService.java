package com.ax.rms.dashboard;

import com.ax.rms.availability.AvailabilityCalculator;
import com.ax.rms.domain.Assignment;
import com.ax.rms.domain.AvailabilityStatus;
import com.ax.rms.domain.Department;
import com.ax.rms.domain.Employee;
import com.ax.rms.domain.EmployeeSkill;
import com.ax.rms.domain.Project;
import com.ax.rms.domain.ProjectRequiredSkillLine;
import com.ax.rms.domain.ProjectStatus;
import com.ax.rms.repository.AssignmentRepository;
import com.ax.rms.repository.DepartmentRepository;
import com.ax.rms.repository.EmployeeRepository;
import com.ax.rms.repository.EmployeeSkillRepository;
import com.ax.rms.repository.ProjectRepository;
import com.ax.rms.repository.ProjectRequiredSkillLineRepository;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;

/**
 * 대시보드 집계(D5). 가용률·확인 필요 계산은 T#7의 {@link AvailabilityCalculator}를 그대로 쓴다(D36 — 백엔드
 * 한 곳에서만 계산). 인력 부족 판정(D20)은 {@link #shortStaffedProjectIds} 서비스 메서드로 둔다 — 후속
 * 태스크 #32가 프로젝트 목록 API에서 재사용한다.
 */
@Service
public class DashboardService {

  /** 대시보드 응답(D5의 아홉 항목). */
  public record DashboardResponse(
      int employeeCount,
      int availableCount,
      int unavailableCount,
      int availableHeadcount,
      int ongoingProjectCount,
      List<ShortStaffedProject> shortStaffedProjects,
      List<EmployeeAvailability> employees,
      List<DepartmentAverage> departments,
      List<EmployeeRef> needsReview) {}

  /** 인력 부족 프로젝트 한 건(D20). */
  public record ShortStaffedProject(
      long id,
      String name,
      int requiredHeadcount,
      int assignedHeadcount,
      List<MissingSkill> missingSkills) {}

  /** 오늘 그 기술을 가진 직원이 한 명도 배치되지 않은 필요 역량 줄. */
  public record MissingSkill(String skill, int requiredHeadcount) {}

  /** 직원의 현재 가용률(D7, D18, D19). */
  public record EmployeeAvailability(long id, String name, int currentAvailability) {}

  /** 부서의 현재 가용률 평균(소수점 둘째 자리에서 반올림). */
  public record DepartmentAverage(long id, String name, BigDecimal averageAvailability) {}

  /** 직원 참조(id, 이름). */
  public record EmployeeRef(long id, String name) {}

  private final EmployeeRepository employeeRepository;
  private final DepartmentRepository departmentRepository;
  private final ProjectRepository projectRepository;
  private final AssignmentRepository assignmentRepository;
  private final EmployeeSkillRepository employeeSkillRepository;
  private final ProjectRequiredSkillLineRepository skillLineRepository;
  private final AvailabilityCalculator calculator;
  private final Clock clock;

  /** 필요한 저장소·계산기·시계로 이 서비스를 만든다. */
  public DashboardService(
      EmployeeRepository employeeRepository,
      DepartmentRepository departmentRepository,
      ProjectRepository projectRepository,
      AssignmentRepository assignmentRepository,
      EmployeeSkillRepository employeeSkillRepository,
      ProjectRequiredSkillLineRepository skillLineRepository,
      AvailabilityCalculator calculator,
      Clock clock) {
    this.employeeRepository = employeeRepository;
    this.departmentRepository = departmentRepository;
    this.projectRepository = projectRepository;
    this.assignmentRepository = assignmentRepository;
    this.employeeSkillRepository = employeeSkillRepository;
    this.skillLineRepository = skillLineRepository;
    this.calculator = calculator;
    this.clock = clock;
  }

  /** D5의 아홉 항목을 "오늘"(주입된 {@link Clock}) 기준으로 집계한다. */
  public DashboardResponse dashboard() {
    LocalDate today = LocalDate.now(clock);
    List<Employee> employees = employeeRepository.findAll();
    List<Project> projects = projectRepository.findAll();
    List<Assignment> assignments = assignmentRepository.findAll();
    Map<Long, Project> projectsById =
        projects.stream().collect(Collectors.toMap(Project::id, project -> project));
    Map<Long, List<Assignment>> assignmentsByEmployee =
        assignments.stream().collect(Collectors.groupingBy(Assignment::employeeId));

    List<EmployeeAvailability> employeeRows = new ArrayList<>();
    List<EmployeeRef> needsReview = new ArrayList<>();
    int availableCount = 0;
    int unavailableCount = 0;
    int availableHeadcount = 0;
    Map<Long, List<Integer>> availabilityByDepartment = new HashMap<>();
    for (Employee employee : employees) {
      List<Assignment> own = assignmentsByEmployee.getOrDefault(employee.id(), List.of());
      int availability = calculator.currentAvailability(own, projectsById, today);
      employeeRows.add(new EmployeeAvailability(employee.id(), employee.name(), availability));
      availabilityByDepartment
          .computeIfAbsent(employee.departmentId(), id -> new ArrayList<>())
          .add(availability);
      if (employee.availabilityStatus() == AvailabilityStatus.AVAILABLE) {
        availableCount++;
        if (availability > 0) {
          availableHeadcount++;
        }
      } else {
        unavailableCount++;
      }
      if (calculator.needsReview(employee.availabilityStatus(), own, today)) {
        needsReview.add(new EmployeeRef(employee.id(), employee.name()));
      }
    }
    employeeRows.sort(Comparator.comparingLong(EmployeeAvailability::id));
    needsReview.sort(Comparator.comparingLong(EmployeeRef::id));

    List<DepartmentAverage> departmentRows =
        departmentRepository
            .findAll()
            .stream()
            .map(
                department ->
                    new DepartmentAverage(
                        department.id(),
                        department.name(),
                        average(availabilityByDepartment.getOrDefault(department.id(), List.of()))))
            .sorted(Comparator.comparingLong(DepartmentAverage::id))
            .toList();

    Map<Long, Set<String>> skillsByEmployee =
        employeeSkillRepository
            .findAll()
            .stream()
            .collect(
                Collectors.groupingBy(
                    EmployeeSkill::employeeId,
                    Collectors.mapping(EmployeeSkill::skillName, Collectors.toSet())));
    List<ShortStaffedProject> shortStaffed = new ArrayList<>();
    for (Project project : projects) {
      if (project.status() != ProjectStatus.IN_PROGRESS) {
        continue;
      }
      List<ProjectRequiredSkillLine> lines = skillLineRepository.findByProjectId(project.id());
      if (isShortStaffed(project, lines, assignments, skillsByEmployee, today)) {
        shortStaffed.add(toShortStaffed(project, lines, assignments, skillsByEmployee, today));
      }
    }
    shortStaffed.sort(Comparator.comparingLong(ShortStaffedProject::id));

    return new DashboardResponse(
        employees.size(),
        availableCount,
        unavailableCount,
        availableHeadcount,
        (int) projects.stream().filter(p -> p.status() == ProjectStatus.IN_PROGRESS).count(),
        shortStaffed,
        employeeRows,
        departmentRows,
        needsReview);
  }

  /**
   * 인력이 부족한 프로젝트의 id 목록을 돌려준다(D20). 대상은 {@code IN_PROGRESS}인 프로젝트만. 부족 조건은
   * 둘 중 하나다.
   *
   * <ol>
   *   <li>{@code today}가 배치 기간 안에 있는 그 프로젝트 배정이 붙은 다른 직원 수가 필요 역량 줄의 인원 합보다
   *       적다.
   *   <li>필요 역량 줄 중 하나라도, 그 기술을 가진 직원(숙련도 무관)이 오늘 그 프로젝트에 한 명도 배치되지
   *       않았다.
   * </ol>
   *
   * @param projects 전체 프로젝트
   * @param assignments 전체 배치
   * @param employeeSkills 전체 직원 기술 줄
   * @param requiredLines 전체 필요 역량 줄
   * @param today 기준일
   * @return 인력 부족 프로젝트의 id 목록
   */
  public static List<Long> shortStaffedProjectIds(
      List<Project> projects,
      List<Assignment> assignments,
      List<EmployeeSkill> employeeSkills,
      List<ProjectRequiredSkillLine> requiredLines,
      LocalDate today) {
    Map<Long, List<ProjectRequiredSkillLine>> linesByProject =
        requiredLines.stream()
            .collect(Collectors.groupingBy(ProjectRequiredSkillLine::projectId));
    Map<Long, Set<String>> skillsByEmployee =
        employeeSkills.stream()
            .collect(
                Collectors.groupingBy(
                    EmployeeSkill::employeeId,
                    Collectors.mapping(EmployeeSkill::skillName, Collectors.toSet())));
    List<Long> result = new ArrayList<>();
    for (Project project : projects) {
      if (project.status() != ProjectStatus.IN_PROGRESS) {
        continue;
      }
      if (isShortStaffed(project, linesByProject.getOrDefault(project.id(), List.of()),
              assignments, skillsByEmployee, today)) {
        result.add(project.id());
      }
    }
    result.sort(Long::compareTo);
    return result;
  }

  /** D20의 부족 조건(둘 중 하나)을 돌려준다. */
  private static boolean isShortStaffed(
      Project project,
      List<ProjectRequiredSkillLine> lines,
      List<Assignment> assignments,
      Map<Long, Set<String>> skillsByEmployee,
      LocalDate today) {
    Set<Long> assignedEmployees =
        todays(assignments, project.id(), today).stream()
            .map(Assignment::employeeId)
            .collect(Collectors.toSet());
    int required = lines.stream().mapToInt(ProjectRequiredSkillLine::headcount).sum();
    if (assignedEmployees.size() < required) {
      return true;
    }
    return lines.stream()
        .anyMatch(
            line ->
                assignedEmployees.stream()
                    .noneMatch(
                        employeeId ->
                            skillsByEmployee
                                .getOrDefault(employeeId, Set.of())
                                .contains(line.skillName())));
  }

  /** 인력 부족 프로젝트 항목(D20)을 만든다. */
  private static ShortStaffedProject toShortStaffed(
      Project project,
      List<ProjectRequiredSkillLine> lines,
      List<Assignment> assignments,
      Map<Long, Set<String>> skillsByEmployee,
      LocalDate today) {
    Set<Long> assignedEmployees =
        todays(assignments, project.id(), today).stream()
            .map(Assignment::employeeId)
            .collect(Collectors.toSet());
    List<MissingSkill> missing =
        lines.stream()
            .filter(
                line ->
                    assignedEmployees.stream()
                        .noneMatch(
                            employeeId ->
                                skillsByEmployee
                                    .getOrDefault(employeeId, Set.of())
                                    .contains(line.skillName())))
            .map(line -> new MissingSkill(line.skillName(), line.headcount()))
            .toList();
    return new ShortStaffedProject(
        project.id(),
        project.name(),
        lines.stream().mapToInt(ProjectRequiredSkillLine::headcount).sum(),
        assignedEmployees.size(),
        missing);
  }

  /** 그 프로젝트의 "오늘 배치"(시작일 ≤ today ≤ 종료일)를 돌려준다. */
  private static List<Assignment> todays(
      List<Assignment> assignments, long projectId, LocalDate today) {
    return assignments.stream()
        .filter(a -> a.projectId() == projectId)
        .filter(a -> !today.isBefore(a.startDate()) && !today.isAfter(a.endDate()))
        .toList();
  }

  /** 산술 평균을 소수점 둘째 자리에서 반올림(HALF_UP)한다. */
  private static BigDecimal average(List<Integer> values) {
    if (values.isEmpty()) {
      return BigDecimal.ZERO;
    }
    int sum = values.stream().mapToInt(Integer::intValue).sum();
    return BigDecimal.valueOf(sum)
        .divide(BigDecimal.valueOf(values.size()), 1, RoundingMode.HALF_UP);
  }
}
