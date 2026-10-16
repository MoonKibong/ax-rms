package com.ax.rms.project;

import com.ax.rms.availability.AvailabilityCalculator;
import com.ax.rms.dashboard.DashboardService;
import com.ax.rms.domain.Assignment;
import com.ax.rms.domain.Employee;
import com.ax.rms.domain.ProficiencyLevel;
import com.ax.rms.domain.Project;
import com.ax.rms.domain.ProjectRequiredSkillLine;
import com.ax.rms.domain.ProjectStatus;
import com.ax.rms.project.ProjectRequest.SkillLineRequest;
import com.ax.rms.repository.AssignmentRepository;
import com.ax.rms.repository.EmployeeRepository;
import com.ax.rms.repository.EmployeeSkillRepository;
import com.ax.rms.repository.ProjectRepository;
import com.ax.rms.repository.ProjectRequiredSkillLineRepository;
import com.ax.rms.web.ApiException;
import java.time.Clock;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 프로젝트 조회·등록·수정(D3, D13, D22, D30). 가용률 계산은 {@link AvailabilityCalculator} 한 곳에서만 하고(D36), "오늘"은
 * {@link Clock}이다(D19). 권한은 보안 설정이 경로·메서드로 정하므로(T#6) 여기서 따로 검사하지 않는다.
 */
@Service
public class ProjectService {

  private static final String STATUS_MESSAGE = "프로젝트 상태를 선택하세요.";
  private static final int MAX_LISTED_ASSIGNMENTS = 3;

  private final ProjectRepository projectRepository;
  private final ProjectRequiredSkillLineRepository skillLineRepository;
  private final AssignmentRepository assignmentRepository;
  private final EmployeeRepository employeeRepository;
  private final EmployeeSkillRepository employeeSkillRepository;
  private final Clock clock;
  private final AvailabilityCalculator calculator = new AvailabilityCalculator();

  /** 저장소와 시계로 서비스를 만든다. */
  public ProjectService(
      ProjectRepository projectRepository,
      ProjectRequiredSkillLineRepository skillLineRepository,
      AssignmentRepository assignmentRepository,
      EmployeeRepository employeeRepository,
      EmployeeSkillRepository employeeSkillRepository,
      Clock clock) {
    this.projectRepository = projectRepository;
    this.skillLineRepository = skillLineRepository;
    this.assignmentRepository = assignmentRepository;
    this.employeeRepository = employeeRepository;
    this.employeeSkillRepository = employeeSkillRepository;
    this.clock = clock;
  }

  /**
   * 프로젝트 목록을 {@code id} 오름차순으로 돌려준다. {@code status}가 있으면 그 상태만 돌려준다. 인력 부족 여부(D20)는 전체
   * 프로젝트로 {@link DashboardService#shortStaffedProjectIds}를 한 번 불러 얻으므로 상태 필터와 상관없다(D36).
   */
  public List<ProjectSummary> list(String status) {
    ProjectStatus filter = status == null ? null : parseStatus(status);
    LocalDate today = LocalDate.now(clock);
    List<Project> projects = projectRepository.findAll();
    List<Assignment> allAssignments = assignmentRepository.findAll();
    List<ProjectRequiredSkillLine> allLines = new ArrayList<>();
    for (Project project : projects) {
      allLines.addAll(skillLineRepository.findByProjectId(project.id()));
    }
    Set<Long> understaffed =
        new HashSet<>(
            DashboardService.shortStaffedProjectIds(
                projects, allAssignments, employeeSkillRepository.findAll(), allLines, today));
    List<ProjectSummary> result = new ArrayList<>();
    for (Project project : projects) {
      if (filter != null && project.status() != filter) {
        continue;
      }
      List<ProjectRequiredSkillLine> lines = skillLineRepository.findByProjectId(project.id());
      List<Assignment> assignments = assignmentRepository.findByProjectId(project.id());
      result.add(
          new ProjectSummary(
              project.id(),
              project.name(),
              project.startDate(),
              project.endDate(),
              project.status(),
              requiredHeadcount(lines),
              assignedHeadcount(assignments, today),
              understaffed.contains(project.id())));
    }
    return result;
  }

  /** 프로젝트 상세를 돌려준다. 없는 id면 404 예외를 던진다. */
  public ProjectDetail detail(long id) {
    Project project = find(id);
    return toDetail(project);
  }

  /** 프로젝트를 등록하고 그 상세를 돌려준다. 검증에 실패하면 400 예외를 던진다. */
  @Transactional
  public ProjectDetail create(ProjectRequest request) {
    Validated validated = validate(request);
    Project saved =
        projectRepository.insert(
            new Project(
                null,
                validated.name(),
                validated.description(),
                validated.startDate(),
                validated.endDate(),
                validated.status()));
    insertLines(saved.id(), validated.lines());
    return toDetail(saved);
  }

  /**
   * 프로젝트를 수정하고 그 상세를 돌려준다. 없는 id면 404, 검증 실패나 기존 배정이 새 기간 밖으로 나가면(D30) 400 예외를 던지며,
   * 그때는 아무것도 바꾸지 않는다.
   */
  @Transactional
  public ProjectDetail update(long id, ProjectRequest request) {
    find(id);
    Validated validated = validate(request);
    rejectAssignmentsOutsidePeriod(id, validated);
    projectRepository.update(
        new Project(
            id,
            validated.name(),
            validated.description(),
            validated.startDate(),
            validated.endDate(),
            validated.status()));
    skillLineRepository.deleteByProjectId(id);
    insertLines(id, validated.lines());
    return toDetail(find(id));
  }

  private Project find(long id) {
    return projectRepository
        .findById(id)
        .orElseThrow(
            () ->
                new ApiException(
                    HttpStatus.NOT_FOUND, "PROJECT_NOT_FOUND", "프로젝트를 찾을 수 없습니다."));
  }

  private void insertLines(long projectId, List<ProjectRequiredSkillLine> lines) {
    for (ProjectRequiredSkillLine line : lines) {
      skillLineRepository.insert(
          new ProjectRequiredSkillLine(
              null,
              projectId,
              line.jobTitle(),
              line.skillName(),
              line.proficiencyLevel(),
              line.headcount()));
    }
  }

  /** D30: 기존 배정 가운데 새 기간 밖으로 나가는 것이 있으면 저장을 막는다. 기간의 양 끝은 그 안에 든다. */
  private void rejectAssignmentsOutsidePeriod(long projectId, Validated validated) {
    Map<Long, String> names = new HashMap<>();
    List<Assignment> outside =
        assignmentRepository.findByProjectId(projectId).stream()
            .filter(
                a ->
                    a.startDate().isBefore(validated.startDate())
                        || a.endDate().isAfter(validated.endDate()))
            .sorted(
                Comparator.comparing(Assignment::startDate)
                    .thenComparing(a -> employeeName(a.employeeId(), names)))
            .toList();
    if (outside.isEmpty()) {
      return;
    }
    String listed =
        outside.stream()
            .limit(MAX_LISTED_ASSIGNMENTS)
            .map(
                a ->
                    employeeName(a.employeeId(), names) + " " + a.startDate() + " ~ " + a.endDate())
            .collect(Collectors.joining(", "));
    throw new ApiException(
        HttpStatus.BAD_REQUEST,
        "PROJECT_PERIOD_EXCLUDES_ASSIGNMENTS",
        "프로젝트 기간을 바꾸면 기간 밖으로 나가는 배정 "
            + outside.size()
            + "건이 있어 저장할 수 없습니다: "
            + listed);
  }

  private String employeeName(long employeeId, Map<Long, String> cache) {
    return cache.computeIfAbsent(
        employeeId,
        id -> employeeRepository.findById(id).map(Employee::name).orElse("(알 수 없는 직원)"));
  }

  private ProjectDetail toDetail(Project project) {
    LocalDate today = LocalDate.now(clock);
    List<ProjectRequiredSkillLine> lines =
        skillLineRepository.findByProjectId(project.id()).stream()
            .sorted(Comparator.comparing(ProjectRequiredSkillLine::id))
            .toList();
    List<Assignment> assignments = assignmentRepository.findByProjectId(project.id());
    Map<Long, Integer> availabilityByEmployee = new HashMap<>();
    Map<Long, String> names = new HashMap<>();
    List<ProjectDetail.AssignedEmployee> assigned =
        assignments.stream()
            .sorted(
                Comparator.comparing(Assignment::startDate)
                    .thenComparing(a -> employeeName(a.employeeId(), names))
                    .thenComparing(Assignment::id))
            .map(
                a ->
                    new ProjectDetail.AssignedEmployee(
                        a.id(),
                        a.employeeId(),
                        employeeName(a.employeeId(), names),
                        a.startDate(),
                        a.endDate(),
                        a.allocationPercent(),
                        availabilityByEmployee.computeIfAbsent(
                            a.employeeId(), id -> currentAvailability(id, today))))
            .toList();
    return new ProjectDetail(
        project.id(),
        project.name(),
        project.description(),
        project.startDate(),
        project.endDate(),
        project.status(),
        lines.stream()
            .map(
                l ->
                    new ProjectDetail.SkillLine(
                        l.jobTitle(), l.skillName(), l.proficiencyLevel(), l.headcount()))
            .toList(),
        requiredHeadcount(lines),
        assignedHeadcount(assignments, today),
        assigned);
  }

  /** 그 직원의 모든 배정으로 현재 가용률을 계산한다(D7, D19, D36). */
  private int currentAvailability(long employeeId, LocalDate today) {
    List<Assignment> all = assignmentRepository.findByEmployeeId(employeeId);
    Map<Long, Project> projectsById = new HashMap<>();
    for (Assignment a : all) {
      projectsById.computeIfAbsent(
          a.projectId(), id -> projectRepository.findById(id).orElseThrow());
    }
    return calculator.currentAvailability(all, projectsById, today);
  }

  private static int requiredHeadcount(List<ProjectRequiredSkillLine> lines) {
    return lines.stream().mapToInt(ProjectRequiredSkillLine::headcount).sum();
  }

  private static int assignedHeadcount(List<Assignment> assignments, LocalDate today) {
    return (int)
        assignments.stream()
            .filter(a -> !today.isBefore(a.startDate()) && !today.isAfter(a.endDate()))
            .map(Assignment::employeeId)
            .distinct()
            .count();
  }

  private record Validated(
      String name,
      String description,
      LocalDate startDate,
      LocalDate endDate,
      ProjectStatus status,
      List<ProjectRequiredSkillLine> lines) {}

  /** 요청을 위에서부터 차례로 검증해 처음 걸리는 위반 하나로 400 예외를 던진다. */
  private Validated validate(ProjectRequest request) {
    if (request.name() == null || request.name().isBlank()) {
      throw badRequest("PROJECT_NAME_REQUIRED", "프로젝트명을 입력하세요.");
    }
    LocalDate start = parseDate(request.startDate());
    LocalDate end = parseDate(request.endDate());
    if (start == null || end == null) {
      throw badRequest("PROJECT_PERIOD_REQUIRED", "시작일과 종료일을 YYYY-MM-DD 형식으로 입력하세요.");
    }
    if (end.isBefore(start)) {
      throw badRequest("PROJECT_PERIOD_INVALID", "종료일은 시작일보다 앞설 수 없습니다.");
    }
    ProjectStatus status = request.status() == null ? null : statusOrNull(request.status());
    if (status == null) {
      throw badRequest("PROJECT_STATUS_INVALID", STATUS_MESSAGE);
    }
    List<ProjectRequiredSkillLine> lines = new ArrayList<>();
    if (request.requiredSkills() != null) {
      for (SkillLineRequest line : request.requiredSkills()) {
        lines.add(validateLine(line));
      }
    }
    return new Validated(request.name(), request.description(), start, end, status, lines);
  }

  private ProjectRequiredSkillLine validateLine(SkillLineRequest line) {
    ProficiencyLevel level = line == null ? null : levelOrNull(line.proficiencyLevel());
    if (line == null
        || isBlank(line.jobTitle())
        || isBlank(line.skillName())
        || level == null
        || line.headcount() == null
        || line.headcount() < 1) {
      throw badRequest(
          "PROJECT_SKILL_LINE_INVALID", "필요 역량의 직무, 기술, 숙련도, 인원(1 이상)을 모두 입력하세요.");
    }
    return new ProjectRequiredSkillLine(
        null, 0, line.jobTitle(), line.skillName(), level, line.headcount());
  }

  private static boolean isBlank(String value) {
    return value == null || value.isBlank();
  }

  private static LocalDate parseDate(String value) {
    if (value == null) {
      return null;
    }
    try {
      return LocalDate.parse(value);
    } catch (DateTimeParseException e) {
      return null;
    }
  }

  private static ProjectStatus statusOrNull(String value) {
    try {
      return ProjectStatus.valueOf(value);
    } catch (IllegalArgumentException e) {
      return null;
    }
  }

  private static ProficiencyLevel levelOrNull(String value) {
    if (value == null) {
      return null;
    }
    try {
      return ProficiencyLevel.valueOf(value);
    } catch (IllegalArgumentException e) {
      return null;
    }
  }

  private static ProjectStatus parseStatus(String value) {
    ProjectStatus status = statusOrNull(value);
    if (status == null) {
      throw badRequest("PROJECT_STATUS_INVALID", STATUS_MESSAGE);
    }
    return status;
  }

  private static ApiException badRequest(String code, String message) {
    return new ApiException(HttpStatus.BAD_REQUEST, code, message);
  }
}
