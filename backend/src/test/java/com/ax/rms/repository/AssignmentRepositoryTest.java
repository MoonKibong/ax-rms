package com.ax.rms.repository;

import static org.assertj.core.api.Assertions.assertThat;

import com.ax.rms.domain.Assignment;
import com.ax.rms.domain.AvailabilityStatus;
import com.ax.rms.domain.Department;
import com.ax.rms.domain.Employee;
import com.ax.rms.domain.Project;
import com.ax.rms.domain.ProjectStatus;
import com.ax.rms.support.AbstractDatabaseTest;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

class AssignmentRepositoryTest extends AbstractDatabaseTest {

  @Autowired private DepartmentRepository departmentRepository;
  @Autowired private EmployeeRepository employeeRepository;
  @Autowired private ProjectRepository projectRepository;
  @Autowired private AssignmentRepository repository;

  @Test
  void insertedAssignmentIsFoundByEmployeeId() {
    Department department = departmentRepository.insert(new Department(null, "개발팀"));
    Employee employee =
        employeeRepository.insert(
            new Employee(
                null, "홍길동", department.id(), "개발자", 3, AvailabilityStatus.AVAILABLE, null, null));
    Project project =
        projectRepository.insert(
            new Project(
                null,
                "알파 프로젝트",
                "설명",
                LocalDate.of(2026, 1, 1),
                LocalDate.of(2026, 12, 31),
                ProjectStatus.IN_PROGRESS));

    repository.insert(
        new Assignment(
            null,
            employee.id(),
            project.id(),
            LocalDate.of(2026, 2, 1),
            LocalDate.of(2026, 6, 1),
            60));

    List<Assignment> assignments = repository.findByEmployeeId(employee.id());
    assertThat(assignments).hasSize(1);
    assertThat(assignments.get(0).projectId()).isEqualTo(project.id());
    assertThat(assignments.get(0).allocationPercent()).isEqualTo(60);
  }

  @Test
  void findByProjectIdReturnsOnlyThatProjectsAssignments() {
    Department department = departmentRepository.insert(new Department(null, "개발팀"));
    Employee first = newEmployee(department, "첫째");
    Employee second = newEmployee(department, "둘째");
    Project busy = newProject("바쁜 프로젝트");
    Project quiet = newProject("한가한 프로젝트");
    repository.insert(
        new Assignment(
            null, first.id(), busy.id(), LocalDate.of(2026, 2, 1), LocalDate.of(2026, 6, 1), 60));
    repository.insert(
        new Assignment(
            null, second.id(), busy.id(), LocalDate.of(2026, 3, 1), LocalDate.of(2026, 7, 1), 30));
    repository.insert(
        new Assignment(
            null, first.id(), quiet.id(), LocalDate.of(2026, 8, 1), LocalDate.of(2026, 9, 1), 10));

    assertThat(repository.findByProjectId(busy.id()))
        .extracting(Assignment::allocationPercent)
        .containsExactlyInAnyOrder(60, 30);
    assertThat(repository.findByProjectId(quiet.id())).hasSize(1);
    Project empty = newProject("배치 없는 프로젝트");
    assertThat(repository.findByProjectId(empty.id())).isEmpty();
  }

  private Employee newEmployee(Department department, String name) {
    return employeeRepository.insert(
        new Employee(
            null, name, department.id(), "개발자", 3, AvailabilityStatus.AVAILABLE, null, null));
  }

  private Project newProject(String name) {
    return projectRepository.insert(
        new Project(
            null,
            name,
            "설명",
            LocalDate.of(2026, 1, 1),
            LocalDate.of(2026, 12, 31),
            ProjectStatus.IN_PROGRESS));
  }
}
