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
}
