package com.ax.rms.seed;

import static org.assertj.core.api.Assertions.assertThat;

import com.ax.rms.repository.AssignmentRepository;
import com.ax.rms.repository.DepartmentRepository;
import com.ax.rms.repository.EmployeeRepository;
import com.ax.rms.repository.ProjectRepository;
import com.ax.rms.support.AbstractSeedTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

class SeedCountTest extends AbstractSeedTest {

  @Autowired private DepartmentRepository departmentRepository;
  @Autowired private EmployeeRepository employeeRepository;
  @Autowired private ProjectRepository projectRepository;
  @Autowired private AssignmentRepository assignmentRepository;

  @Test
  void matchesD31Counts() {
    assertThat(departmentRepository.count()).isEqualTo(3);
    assertThat(employeeRepository.count()).isEqualTo(20);
    assertThat(projectRepository.count()).isEqualTo(5);
    assertThat(assignmentRepository.count()).isEqualTo(15);
  }
}
