package com.ax.rms.repository;

import static org.assertj.core.api.Assertions.assertThat;

import com.ax.rms.domain.Account;
import com.ax.rms.domain.AvailabilityStatus;
import com.ax.rms.domain.Department;
import com.ax.rms.domain.Employee;
import com.ax.rms.domain.Role;
import com.ax.rms.support.AbstractDatabaseTest;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

class AccountRepositoryTest extends AbstractDatabaseTest {

  @Autowired private DepartmentRepository departmentRepository;
  @Autowired private EmployeeRepository employeeRepository;
  @Autowired private AccountRepository repository;

  @Test
  void insertedAccountAndRolesAreFoundByUsername() {
    Department department = departmentRepository.insert(new Department(null, "개발팀"));
    Employee employee =
        employeeRepository.insert(
            new Employee(
                null, "홍길동", department.id(), "개발자", 3, AvailabilityStatus.AVAILABLE, null, null));

    Account inserted =
        repository.insert(new Account(null, employee.id(), "hong", "hashed-password"));
    repository.assignRole(inserted.id(), Role.EMPLOYEE);
    repository.assignRole(inserted.id(), Role.HR_MANAGER);

    Account found = repository.findByUsername("hong").orElseThrow();
    assertThat(found.employeeId()).isEqualTo(employee.id());
    assertThat(found.passwordHash()).isEqualTo("hashed-password");
    assertThat(repository.findRoles(found.id())).isEqualTo(Set.of(Role.EMPLOYEE, Role.HR_MANAGER));
  }
}
