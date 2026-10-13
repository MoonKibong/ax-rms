package com.ax.rms.repository;

import static org.assertj.core.api.Assertions.assertThat;

import com.ax.rms.domain.Department;
import com.ax.rms.support.AbstractDatabaseTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

class DepartmentRepositoryTest extends AbstractDatabaseTest {

  @Autowired private DepartmentRepository repository;

  @Test
  void insertedDepartmentIsFoundById() {
    Department inserted = repository.insert(new Department(null, "개발팀"));
    assertThat(inserted.id()).isNotNull();

    Department found = repository.findById(inserted.id()).orElseThrow();
    assertThat(found.name()).isEqualTo("개발팀");
  }
}
