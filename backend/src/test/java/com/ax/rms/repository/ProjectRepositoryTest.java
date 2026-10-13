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

  @Test
  void nullDescriptionIsPreservedAsNullNotAsEmptyString() {
    Project inserted =
        repository.insert(
            new Project(
                null,
                "설명 없는 프로젝트",
                null,
                LocalDate.of(2026, 1, 1),
                LocalDate.of(2026, 12, 31),
                ProjectStatus.PLANNED));

    Project found = repository.findById(inserted.id()).orElseThrow();
    assertThat(found.description()).isNull();
  }

  @Test
  void updateChangesFieldsAndReportsWhetherRowChanged() {
    Project inserted =
        repository.insert(
            new Project(
                null,
                "옛 이름",
                "옛 설명",
                LocalDate.of(2026, 1, 1),
                LocalDate.of(2026, 12, 31),
                ProjectStatus.PLANNED));

    boolean changed =
        repository.update(
            new Project(
                inserted.id(),
                "새 이름",
                null,
                LocalDate.of(2026, 2, 1),
                LocalDate.of(2026, 11, 30),
                ProjectStatus.ON_HOLD));

    assertThat(changed).isTrue();
    Project found = repository.findById(inserted.id()).orElseThrow();
    assertThat(found.name()).isEqualTo("새 이름");
    assertThat(found.description()).isNull();
    assertThat(found.startDate()).isEqualTo(LocalDate.of(2026, 2, 1));
    assertThat(found.endDate()).isEqualTo(LocalDate.of(2026, 11, 30));
    assertThat(found.status()).isEqualTo(ProjectStatus.ON_HOLD);

    boolean unknown =
        repository.update(
            new Project(
                999_999L,
                "없는 프로젝트",
                null,
                LocalDate.of(2026, 1, 1),
                LocalDate.of(2026, 1, 2),
                ProjectStatus.PLANNED));
    assertThat(unknown).isFalse();
  }
}
