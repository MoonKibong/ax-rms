package com.ax.rms.repository;

import static org.assertj.core.api.Assertions.assertThat;

import com.ax.rms.domain.AvailabilityStatus;
import com.ax.rms.domain.Department;
import com.ax.rms.domain.Employee;
import com.ax.rms.support.AbstractDatabaseTest;
import java.time.LocalDate;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

class EmployeeRepositoryTest extends AbstractDatabaseTest {

  @Autowired private DepartmentRepository departmentRepository;
  @Autowired private EmployeeRepository repository;

  @Test
  void insertedEmployeeIsFoundByIdWithAllFields() {
    Department department = departmentRepository.insert(new Department(null, "개발팀"));

    Employee inserted =
        repository.insert(
            new Employee(
                null,
                "홍길동",
                department.id(),
                "백엔드 개발자",
                5,
                AvailabilityStatus.UNAVAILABLE,
                "육아휴직",
                LocalDate.of(2026, 12, 31)));

    Employee found = repository.findById(inserted.id()).orElseThrow();
    assertThat(found.name()).isEqualTo("홍길동");
    assertThat(found.departmentId()).isEqualTo(department.id());
    assertThat(found.jobTitle()).isEqualTo("백엔드 개발자");
    assertThat(found.careerYears()).isEqualTo(5);
    assertThat(found.availabilityStatus()).isEqualTo(AvailabilityStatus.UNAVAILABLE);
    assertThat(found.unavailableReason()).isEqualTo("육아휴직");
    assertThat(found.unavailableUntil()).isEqualTo(LocalDate.of(2026, 12, 31));
  }
}
