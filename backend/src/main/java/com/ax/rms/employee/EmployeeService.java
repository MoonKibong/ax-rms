package com.ax.rms.employee;

import com.ax.rms.availability.AvailabilityCalculator;
import com.ax.rms.domain.Assignment;
import com.ax.rms.domain.AvailabilityStatus;
import com.ax.rms.domain.Department;
import com.ax.rms.domain.Employee;
import com.ax.rms.domain.EmployeeSkill;
import com.ax.rms.domain.ProficiencyLevel;
import com.ax.rms.domain.Project;
import com.ax.rms.repository.AssignmentRepository;
import com.ax.rms.repository.DepartmentRepository;
import com.ax.rms.repository.EmployeeRepository;
import com.ax.rms.repository.EmployeeSkillRepository;
import com.ax.rms.repository.ProjectRepository;
import com.ax.rms.web.ApiException;
import java.time.Clock;
import java.time.LocalDate;
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

/** 직원 목록·상세·등록·수정·상태 변경 업무 로직(D2, D6, D7, D15, D18, D19, D21, D33). */
@Service
public class EmployeeService {

  private final EmployeeRepository employeeRepository;
  private final EmployeeSkillRepository employeeSkillRepository;
  private final DepartmentRepository departmentRepository;
  private final AssignmentRepository assignmentRepository;
  private final ProjectRepository projectRepository;
  private final AvailabilityCalculator availabilityCalculator;
  private final Clock clock;

  /** 필요한 저장소·계산기·시계로 이 서비스를 만든다. */
  public EmployeeService(
      EmployeeRepository employeeRepository,
      EmployeeSkillRepository employeeSkillRepository,
      DepartmentRepository departmentRepository,
      AssignmentRepository assignmentRepository,
      ProjectRepository projectRepository,
      AvailabilityCalculator availabilityCalculator,
      Clock clock) {
    this.employeeRepository = employeeRepository;
    this.employeeSkillRepository = employeeSkillRepository;
    this.departmentRepository = departmentRepository;
    this.assignmentRepository = assignmentRepository;
    this.projectRepository = projectRepository;
    this.availabilityCalculator = availabilityCalculator;
    this.clock = clock;
  }

  /** 필터를 적용한 직원 목록을 {@code id} 오름차순으로 돌려준다(D2). */
  public List<EmployeeListItemResponse> list(
      String name, Long departmentId, String skill, AvailabilityStatus status,
      Integer minAvailability) {
    LocalDate today = LocalDate.now(clock);
    Map<Long, Project> projectsById =
        projectRepository.findAll().stream()
            .collect(Collectors.toMap(Project::id, project -> project));
    Map<Long, List<Assignment>> assignmentsByEmployee =
        assignmentRepository.findAll().stream()
            .collect(Collectors.groupingBy(Assignment::employeeId));
    Map<Long, String> departmentNames =
        departmentRepository.findAll().stream()
            .collect(Collectors.toMap(Department::id, Department::name));
    Map<Long, List<EmployeeSkillResponse>> skillsByEmployee =
        employeeSkillRepository.findAll().stream()
            .sorted(Comparator.comparing(EmployeeSkill::id))
            .collect(
                Collectors.groupingBy(
                    EmployeeSkill::employeeId,
                    Collectors.mapping(
                        line ->
                            new EmployeeSkillResponse(line.skillName(), line.proficiencyLevel()),
                        Collectors.toList())));

    List<EmployeeListItemResponse> result = new ArrayList<>();
    for (Employee employee : employeeRepository.findAll()) {
      if (name != null && !employee.name().contains(name)) {
        continue;
      }
      if (departmentId != null && employee.departmentId() != departmentId) {
        continue;
      }
      List<EmployeeSkillResponse> skills =
          skillsByEmployee.getOrDefault(employee.id(), List.of());
      if (skill != null && skills.stream().noneMatch(line -> line.skillName().equals(skill))) {
        continue;
      }
      if (status != null && employee.availabilityStatus() != status) {
        continue;
      }
      List<Assignment> assignments =
          assignmentsByEmployee.getOrDefault(employee.id(), List.of());
      int currentAvailability =
          availabilityCalculator.currentAvailability(assignments, projectsById, today);
      if (minAvailability != null && currentAvailability < minAvailability) {
        continue;
      }
      boolean needsReview =
          availabilityCalculator.needsReview(employee.availabilityStatus(), assignments, today);
      result.add(
          new EmployeeListItemResponse(
              employee.id(),
              employee.name(),
              employee.departmentId(),
              departmentNames.get(employee.departmentId()),
              employee.jobTitle(),
              employee.careerYears(),
              employee.availabilityStatus(),
              currentAvailability,
              needsReview,
              skills));
    }
    result.sort(Comparator.comparingLong(EmployeeListItemResponse::id));
    return result;
  }

  /** 직원 상세를 돌려준다. 없으면 {@code EMPLOYEE_NOT_FOUND}(404)를 던진다. */
  public EmployeeDetailResponse detail(long id) {
    Employee employee = employeeRepository.findById(id).orElseThrow(this::notFound);
    return toDetail(employee);
  }

  /** 새 직원을 등록한다(항상 {@code AVAILABLE}로 시작, D6). 기술 삽입까지 하나의 트랜잭션이다(T#54, B#3). */
  @Transactional
  public EmployeeDetailResponse register(EmployeeUpsertRequest request) {
    validateUpsert(request);
    Employee inserted =
        employeeRepository.insert(
            new Employee(
                null,
                request.name(),
                request.departmentId(),
                request.jobTitle(),
                request.careerYears(),
                AvailabilityStatus.AVAILABLE,
                null,
                null));
    insertSkills(inserted.id(), request.skills());
    return toDetail(employeeRepository.findById(inserted.id()).orElseThrow(this::notFound));
  }

  /**
   * 직원 정보와 기술을 수정한다. 투입 상태 관련 필드는 바꾸지 않는다(D6). 기술을 지우고 다시 넣는 것까지
   * 하나의 트랜잭션이다(T#54, B#3).
   */
  @Transactional
  public EmployeeDetailResponse update(long id, EmployeeUpsertRequest request) {
    Employee existing = employeeRepository.findById(id).orElseThrow(this::notFound);
    validateUpsert(request);
    employeeRepository.update(
        new Employee(
            id,
            request.name(),
            request.departmentId(),
            request.jobTitle(),
            request.careerYears(),
            existing.availabilityStatus(),
            existing.unavailableReason(),
            existing.unavailableUntil()));
    employeeSkillRepository.deleteByEmployeeId(id);
    insertSkills(id, request.skills());
    return toDetail(employeeRepository.findById(id).orElseThrow(this::notFound));
  }

  /** 투입 상태를 바꾼다. 기존 배치는 건드리지 않는다(D6). */
  public EmployeeDetailResponse changeStatus(long id, EmployeeStatusChangeRequest request) {
    Employee existing = employeeRepository.findById(id).orElseThrow(this::notFound);
    AvailabilityStatus newStatus = parseStatus(request.availabilityStatus());
    Employee updated;
    if (newStatus == AvailabilityStatus.UNAVAILABLE) {
      if (isBlank(request.unavailableReason())) {
        throw badRequest("EMPLOYEE_REASON_REQUIRED", "투입 불가 사유를 입력하세요.");
      }
      updated =
          new Employee(
              id,
              existing.name(),
              existing.departmentId(),
              existing.jobTitle(),
              existing.careerYears(),
              AvailabilityStatus.UNAVAILABLE,
              request.unavailableReason(),
              request.unavailableUntil());
    } else {
      updated =
          new Employee(
              id,
              existing.name(),
              existing.departmentId(),
              existing.jobTitle(),
              existing.careerYears(),
              AvailabilityStatus.AVAILABLE,
              null,
              null);
    }
    employeeRepository.update(updated);
    return toDetail(employeeRepository.findById(id).orElseThrow(this::notFound));
  }

  private EmployeeDetailResponse toDetail(Employee employee) {
    LocalDate today = LocalDate.now(clock);
    String departmentName =
        departmentRepository.findById(employee.departmentId()).map(Department::name).orElse(null);
    List<EmployeeSkillResponse> skills =
        employeeSkillRepository.findByEmployeeId(employee.id()).stream()
            .map(line -> new EmployeeSkillResponse(line.skillName(), line.proficiencyLevel()))
            .toList();
    List<Assignment> assignments =
        assignmentRepository.findByEmployeeId(employee.id()).stream()
            .sorted(Comparator.comparing(Assignment::startDate))
            .toList();
    Map<Long, Project> projectsById = new HashMap<>();
    List<AssignmentSummaryResponse> assignmentResponses = new ArrayList<>();
    for (Assignment assignment : assignments) {
      Project project = projectRepository.findById(assignment.projectId()).orElseThrow();
      projectsById.put(project.id(), project);
      assignmentResponses.add(
          new AssignmentSummaryResponse(
              project.id(),
              project.name(),
              project.status(),
              assignment.startDate(),
              assignment.endDate(),
              assignment.allocationPercent()));
    }
    int currentAvailability =
        availabilityCalculator.currentAvailability(assignments, projectsById, today);
    boolean needsReview =
        availabilityCalculator.needsReview(employee.availabilityStatus(), assignments, today);
    return new EmployeeDetailResponse(
        employee.id(),
        employee.name(),
        employee.departmentId(),
        departmentName,
        employee.jobTitle(),
        employee.careerYears(),
        employee.availabilityStatus(),
        employee.unavailableReason(),
        employee.unavailableUntil(),
        currentAvailability,
        needsReview,
        skills,
        assignmentResponses,
        today);
  }

  private void validateUpsert(EmployeeUpsertRequest request) {
    if (isBlank(request.name())) {
      throw badRequest("EMPLOYEE_NAME_REQUIRED", "이름을 입력하세요.");
    }
    if (isBlank(request.jobTitle())) {
      throw badRequest("EMPLOYEE_JOB_TITLE_REQUIRED", "직무를 입력하세요.");
    }
    if (request.departmentId() == null
        || departmentRepository.findById(request.departmentId()).isEmpty()) {
      throw badRequest("EMPLOYEE_DEPARTMENT_NOT_FOUND", "부서를 찾을 수 없습니다.");
    }
    if (request.careerYears() == null || request.careerYears() < 0) {
      throw badRequest("EMPLOYEE_CAREER_YEARS_INVALID", "경력은 0년 이상이어야 합니다.");
    }
    List<EmployeeSkillRequest> skills = request.skills() == null ? List.of() : request.skills();
    Set<String> seenSkillNames = new HashSet<>();
    for (EmployeeSkillRequest skill : skills) {
      if (skill == null
          || isBlank(skill.skillName())
          || parseProficiency(skill.proficiencyLevel()) == null) {
        throw badRequest("EMPLOYEE_SKILL_INVALID", "기술 이름과 숙련도를 올바르게 입력하세요.");
      }
      if (!seenSkillNames.add(skill.skillName())) {
        throw badRequest("EMPLOYEE_SKILL_DUPLICATE", "같은 기술을 두 번 등록할 수 없습니다.");
      }
    }
  }

  private void insertSkills(long employeeId, List<EmployeeSkillRequest> skills) {
    if (skills == null) {
      return;
    }
    for (EmployeeSkillRequest skill : skills) {
      employeeSkillRepository.insert(
          new EmployeeSkill(
              null, employeeId, skill.skillName(), parseProficiency(skill.proficiencyLevel())));
    }
  }

  private ProficiencyLevel parseProficiency(String value) {
    try {
      return ProficiencyLevel.valueOf(value);
    } catch (RuntimeException e) {
      return null;
    }
  }

  private AvailabilityStatus parseStatus(String value) {
    try {
      return AvailabilityStatus.valueOf(value);
    } catch (RuntimeException e) {
      throw badRequest("EMPLOYEE_STATUS_INVALID", "투입 상태 값이 올바르지 않습니다.");
    }
  }

  private boolean isBlank(String value) {
    return value == null || value.isBlank();
  }

  private ApiException notFound() {
    return new ApiException(HttpStatus.NOT_FOUND, "EMPLOYEE_NOT_FOUND", "직원을 찾을 수 없습니다.");
  }

  private ApiException badRequest(String code, String message) {
    return new ApiException(HttpStatus.BAD_REQUEST, code, message);
  }
}
