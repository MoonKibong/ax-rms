package com.ax.rms.repository;

import static org.assertj.core.api.Assertions.assertThat;

import com.ax.rms.domain.ProficiencyLevel;
import com.ax.rms.domain.Project;
import com.ax.rms.domain.ProjectRequiredSkillLine;
import com.ax.rms.domain.ProjectStatus;
import com.ax.rms.support.AbstractDatabaseTest;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

class ProjectRequiredSkillLineRepositoryTest extends AbstractDatabaseTest {

  @Autowired private ProjectRepository projectRepository;
  @Autowired private ProjectRequiredSkillLineRepository repository;

  @Test
  void insertedLineIsFoundByProjectId() {
    Project project =
        projectRepository.insert(
            new Project(
                null,
                "알파 프로젝트",
                "설명",
                LocalDate.of(2026, 1, 1),
                LocalDate.of(2026, 12, 31),
                ProjectStatus.PLANNED));

    repository.insert(
        new ProjectRequiredSkillLine(
            null, project.id(), "백엔드 개발자", "Java", ProficiencyLevel.ADVANCED, 2));

    List<ProjectRequiredSkillLine> lines = repository.findByProjectId(project.id());
    assertThat(lines).hasSize(1);
    assertThat(lines.get(0).jobTitle()).isEqualTo("백엔드 개발자");
    assertThat(lines.get(0).skillName()).isEqualTo("Java");
    assertThat(lines.get(0).proficiencyLevel()).isEqualTo(ProficiencyLevel.ADVANCED);
    assertThat(lines.get(0).headcount()).isEqualTo(2);
  }
}
