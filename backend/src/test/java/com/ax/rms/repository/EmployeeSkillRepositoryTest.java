package com.ax.rms.repository;

import static org.assertj.core.api.Assertions.assertThat;

import com.ax.rms.domain.AvailabilityStatus;
import com.ax.rms.domain.Department;
import com.ax.rms.domain.Employee;
import com.ax.rms.domain.EmployeeSkill;
import com.ax.rms.domain.ProficiencyLevel;
import com.ax.rms.support.AbstractDatabaseTest;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

class EmployeeSkillRepositoryTest extends AbstractDatabaseTest {

  @Autowired private DepartmentRepository departmentRepository;
  @Autowired private EmployeeRepository employeeRepository;
  @Autowired private EmployeeSkillRepository repository;

  @Test
  void insertedSkillIsFoundByEmployeeId() {
    Department department = departmentRepository.insert(new Department(null, "개발팀"));
    Employee employee =
        employeeRepository.insert(
            new Employee(
                null, "홍길동", department.id(), "개발자", 3, AvailabilityStatus.AVAILABLE, null, null));

    repository.insert(new EmployeeSkill(null, employee.id(), "Java", ProficiencyLevel.ADVANCED));

    List<EmployeeSkill> skills = repository.findByEmployeeId(employee.id());
    assertThat(skills).hasSize(1);
    assertThat(skills.get(0).skillName()).isEqualTo("Java");
    assertThat(skills.get(0).proficiencyLevel()).isEqualTo(ProficiencyLevel.ADVANCED);
  }
}
