package com.ax.rms.repository;

import static org.assertj.core.api.Assertions.assertThat;

import com.ax.rms.domain.Project;
import com.ax.rms.domain.ProjectStatus;
import com.ax.rms.support.AbstractDatabaseTest;
import java.time.LocalDate;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

class ProjectRepositoryTest extends AbstractDatabaseTest {

  @Autowired private ProjectRepository repository;

  @Test
  void insertedProjectIsFoundById() {
    Project inserted =
        repository.insert(
            new Project(
                null,
                "알파 프로젝트",
                "설명",
                LocalDate.of(2026, 1, 1),
                LocalDate.of(2026, 12, 31),
                ProjectStatus.IN_PROGRESS));

    Project found = repository.findById(inserted.id()).orElseThrow();
    assertThat(found.name()).isEqualTo("알파 프로젝트");
    assertThat(found.startDate()).isEqualTo(LocalDate.of(2026, 1, 1));
    assertThat(found.endDate()).isEqualTo(LocalDate.of(2026, 12, 31));
    assertThat(found.status()).isEqualTo(ProjectStatus.IN_PROGRESS);
  }
}
