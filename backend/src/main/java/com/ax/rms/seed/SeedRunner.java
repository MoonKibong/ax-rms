package com.ax.rms.seed;

import com.ax.rms.domain.Account;
import com.ax.rms.domain.Assignment;
import com.ax.rms.domain.AvailabilityStatus;
import com.ax.rms.domain.Department;
import com.ax.rms.domain.Employee;
import com.ax.rms.domain.EmployeeSkill;
import com.ax.rms.domain.ProficiencyLevel;
import com.ax.rms.domain.Project;
import com.ax.rms.domain.ProjectRequiredSkillLine;
import com.ax.rms.domain.ProjectStatus;
import com.ax.rms.domain.Role;
import com.ax.rms.repository.AccountRepository;
import com.ax.rms.repository.AssignmentRepository;
import com.ax.rms.repository.DepartmentRepository;
import com.ax.rms.repository.EmployeeRepository;
import com.ax.rms.repository.EmployeeSkillRepository;
import com.ax.rms.repository.ProjectRepository;
import com.ax.rms.repository.ProjectRequiredSkillLineRepository;
import java.time.Clock;
import java.time.LocalDate;
import java.util.List;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

/**
 * 빈 DB로 처음 실행할 때 D31의 시드(부서3·직원20·프로젝트5·배치15, §7 시나리오 데이터, 데모 계정 4개)를 넣는다.
 * 부서가 하나도 없을 때만 넣는다(멱등). "오늘"은 주입된 {@link Clock}을 쓴다(D19) — 테스트는 이 빈을 고정값으로 바꿔
 * 시더와 같은 "오늘"을 본다.
 */
@Component
public class SeedRunner implements ApplicationRunner {

  private final DepartmentRepository departmentRepository;
  private final EmployeeRepository employeeRepository;
  private final EmployeeSkillRepository employeeSkillRepository;
  private final ProjectRepository projectRepository;
  private final ProjectRequiredSkillLineRepository skillLineRepository;
  private final AssignmentRepository assignmentRepository;
  private final AccountRepository accountRepository;
  private final PasswordEncoder passwordEncoder;
  private final Clock clock;

  /** 주어진 저장소·인코더·시계로 이 시더를 만든다. */
  public SeedRunner(
      DepartmentRepository departmentRepository,
      EmployeeRepository employeeRepository,
      EmployeeSkillRepository employeeSkillRepository,
      ProjectRepository projectRepository,
      ProjectRequiredSkillLineRepository skillLineRepository,
      AssignmentRepository assignmentRepository,
      AccountRepository accountRepository,
      PasswordEncoder passwordEncoder,
      Clock clock) {
    this.departmentRepository = departmentRepository;
    this.employeeRepository = employeeRepository;
    this.employeeSkillRepository = employeeSkillRepository;
    this.projectRepository = projectRepository;
    this.skillLineRepository = skillLineRepository;
    this.assignmentRepository = assignmentRepository;
    this.accountRepository = accountRepository;
    this.passwordEncoder = passwordEncoder;
    this.clock = clock;
  }

  @Override
  public void run(ApplicationArguments args) {
    if (departmentRepository.count() > 0) {
      return;
    }
    LocalDate today = LocalDate.now(clock);

    List<Long> departmentIds = insertDepartments();
    List<Long> employeeIds = insertEmployees(departmentIds, today);
    List<Long> projectIds = insertProjects(today);
    insertRequiredSkillLines(projectIds);
    insertAssignments(employeeIds, projectIds, today);
    insertDemoAccounts(employeeIds);
  }

  private List<Long> insertDepartments() {
    return List.of(
        departmentRepository.insert(new Department(null, "개발팀")).id(),
        departmentRepository.insert(new Department(null, "기획팀")).id(),
        departmentRepository.insert(new Department(null, "디자인팀")).id());
  }

  private List<Long> insertEmployees(List<Long> departmentIds, LocalDate today) {
    long dev = departmentIds.get(0);
    long planning = departmentIds.get(1);
    long design = departmentIds.get(2);

    Employee e1 =
        new Employee(null, "박소영", dev, "백엔드 개발자", 5, AvailabilityStatus.AVAILABLE, null, null);
    Employee e2 =
        new Employee(
            null,
            "최동훈",
            dev,
            "프런트엔드 개발자",
            3,
            AvailabilityStatus.UNAVAILABLE,
            "육아휴직",
            today.plusDays(60));
    Employee e3 =
        new Employee(null, "이수민", planning, "인사 담당", 7, AvailabilityStatus.AVAILABLE, null, null);
    Employee e4 =
        new Employee(null, "정하늘", planning, "PM", 8, AvailabilityStatus.AVAILABLE, null, null);
    Employee e5 =
        new Employee(null, "한지우", dev, "개발자", 2, AvailabilityStatus.AVAILABLE, null, null);
    Employee e6 =
        new Employee(null, "오승현", design, "디자인팀장", 10, AvailabilityStatus.AVAILABLE, null, null);

    long id1 = employeeRepository.insert(e1).id();
    long id2 = employeeRepository.insert(e2).id();
    long id3 = employeeRepository.insert(e3).id();
    long id4 = employeeRepository.insert(e4).id();
    long id5 = employeeRepository.insert(e5).id();
    long id6 = employeeRepository.insert(e6).id();

    employeeSkillRepository.insert(new EmployeeSkill(null, id1, "Java", ProficiencyLevel.ADVANCED));
    employeeSkillRepository.insert(
        new EmployeeSkill(null, id2, "React", ProficiencyLevel.INTERMEDIATE));
    employeeSkillRepository.insert(new EmployeeSkill(null, id5, "Java", ProficiencyLevel.BEGINNER));

    String[] fillerNames = {
      "강민재", "윤서아", "임도윤", "조하준", "장지호", "유시우", "신예은", "권지안", "황서윤", "안유진", "송민서", "문채원",
      "백주원", "서하윤"
    };
    long[] fillerDepartments = {
      dev, planning, design, dev, planning, design, dev,
      planning, design, dev, planning, design, dev, planning
    };
    java.util.List<Long> ids = new java.util.ArrayList<>(List.of(id1, id2, id3, id4, id5, id6));
    for (int i = 0; i < fillerNames.length; i++) {
      Employee filler =
          new Employee(
              null,
              fillerNames[i],
              fillerDepartments[i],
              "개발자",
              (i % 8) + 1,
              AvailabilityStatus.AVAILABLE,
              null,
              null);
      ids.add(employeeRepository.insert(filler).id());
    }
    return ids;
  }

  private List<Long> insertProjects(LocalDate today) {
    long p1 =
        projectRepository
            .insert(
                new Project(
                    null,
                    "알파 프로젝트",
                    "사내 포털 리뉴얼",
                    today.minusDays(30),
                    today.plusDays(90),
                    ProjectStatus.IN_PROGRESS))
            .id();
    long p2 =
        projectRepository
            .insert(
                new Project(
                    null,
                    "감마 프로젝트",
                    "레거시 마이그레이션",
                    today.minusDays(250),
                    today.minusDays(100),
                    ProjectStatus.DONE))
            .id();
    long p3 =
        projectRepository
            .insert(
                new Project(
                    null,
                    "베타 프로젝트",
                    "모바일 앱 개편",
                    today.minusDays(20),
                    today.plusDays(60),
                    ProjectStatus.IN_PROGRESS))
            .id();
    long p4 =
        projectRepository
            .insert(
                new Project(
                    null,
                    "델타 프로젝트",
                    "신규 서비스 기획",
                    today.plusDays(30),
                    today.plusDays(120),
                    ProjectStatus.PLANNED))
            .id();
    long p5 =
        projectRepository
            .insert(
                new Project(
                    null,
                    "엡실론 프로젝트",
                    "내부 도구 개선",
                    today.minusDays(60),
                    today.plusDays(30),
                    ProjectStatus.ON_HOLD))
            .id();
    return List.of(p1, p2, p3, p4, p5);
  }

  private void insertRequiredSkillLines(List<Long> projectIds) {
    String[] jobTitles = {"백엔드 개발자", "백엔드 개발자", "프런트엔드 개발자", "기획자", "백엔드 개발자"};
    String[] skills = {"Java", "Java", "React", "기획", "Java"};
    for (int i = 0; i < projectIds.size(); i++) {
      skillLineRepository.insert(
          new ProjectRequiredSkillLine(
              null, projectIds.get(i), jobTitles[i], skills[i], ProficiencyLevel.INTERMEDIATE, 2));
    }
  }

  private void insertAssignments(List<Long> employeeIds, List<Long> projectIds, LocalDate today) {
    long e1 = employeeIds.get(0);
    long e2 = employeeIds.get(1);
    long p1 = projectIds.get(0);
    long p2 = projectIds.get(1);
    long p3 = projectIds.get(2);
    long p4 = projectIds.get(3);
    long p5 = projectIds.get(4);

    // §7 시나리오 (a): E1이 P1(오늘을 포함하는 IN_PROGRESS)에 60% 배치.
    assignmentRepository.insert(
        new Assignment(null, e1, p1, today.minusDays(20), today.plusDays(40), 60));
    // §7 시나리오 (c): E1이 (a)와 겹치지 않는 기간에 P2(DONE, 종료된 프로젝트)에 30% 배치.
    assignmentRepository.insert(
        new Assignment(null, e1, p2, today.minusDays(200), today.minusDays(150), 30));
    // §7 시나리오 (b): 투입 불가인 E2가 P3(오늘을 포함하는 IN_PROGRESS)에 40% 배치 → "확인 필요".
    assignmentRepository.insert(
        new Assignment(null, e2, p3, today.minusDays(10), today.plusDays(30), 40));

    // 나머지 12건: 직원마다 하나씩, 전부 자신의 프로젝트 기간 안, 같은 직원·같은 프로젝트 겹침 없음(서로 다른 직원이라
    // D27과 무관하고, 직원별로 배치가 하나뿐이라 D8의 날짜별 합계도 항상 그 배치의 투입률 그대로다).
    long[][] fillers = {
      // {employeeIds의 인덱스, projectIds의 인덱스, 투입률, 시작(오늘기준 일수), 종료(오늘기준 일수)}
      {6, 0, 40, -25, 80},
      {7, 1, 50, -240, -110},
      {8, 2, 65, -15, 55},
      {9, 3, 50, 35, 100},
      {10, 3, 40, 40, 110},
      {11, 4, 30, -50, 20},
      {12, 4, 70, -55, 25},
      {13, 0, 45, -28, 85},
      {14, 1, 35, -230, -120},
      {15, 2, 25, -18, 58},
      {16, 3, 65, 32, 115},
      {17, 4, 45, -58, 28}
    };
    long[] projectByIndex = {p1, p2, p3, p4, p5};
    for (long[] f : fillers) {
      long employeeId = employeeIds.get((int) f[0]);
      long projectId = projectByIndex[(int) f[1]];
      int allocation = (int) f[2];
      LocalDate start = today.plusDays(f[3]);
      LocalDate end = today.plusDays(f[4]);
      assignmentRepository.insert(
          new Assignment(null, employeeId, projectId, start, end, allocation));
    }
  }

  private void insertDemoAccounts(List<Long> employeeIds) {
    createAccount(employeeIds.get(2), "hr.manager", "HrManager!1", Role.EMPLOYEE, Role.HR_MANAGER);
    createAccount(
        employeeIds.get(3),
        "project.manager",
        "ProjectManager!1",
        Role.EMPLOYEE,
        Role.PROJECT_MANAGER);
    createAccount(employeeIds.get(4), "employee.demo", "Employee!1", Role.EMPLOYEE);
    createAccount(
        employeeIds.get(5),
        "dual.manager",
        "DualManager!1",
        Role.EMPLOYEE,
        Role.HR_MANAGER,
        Role.PROJECT_MANAGER);
  }

  private void createAccount(
      long employeeId, String username, String plainPassword, Role... roles) {
    Account account =
        accountRepository.insert(
            new Account(null, employeeId, username, passwordEncoder.encode(plainPassword)));
    for (Role role : roles) {
      accountRepository.assignRole(account.id(), role);
    }
  }
}
