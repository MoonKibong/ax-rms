package com.ax.rms.repository.jdbc;

import com.ax.rms.domain.ProficiencyLevel;
import com.ax.rms.domain.ProjectRequiredSkillLine;
import com.ax.rms.repository.ProjectRequiredSkillLineRepository;
import java.util.List;
import java.util.Map;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.simple.SimpleJdbcInsert;
import org.springframework.stereotype.Repository;

/** {@link ProjectRequiredSkillLineRepository}의 JDBC 구현. */
@Repository
public class JdbcProjectRequiredSkillLineRepository implements ProjectRequiredSkillLineRepository {

  private static final RowMapper<ProjectRequiredSkillLine> ROW_MAPPER =
      (rs, rowNum) ->
          new ProjectRequiredSkillLine(
              rs.getLong("id"),
              rs.getLong("project_id"),
              rs.getString("job_title"),
              rs.getString("skill_name"),
              ProficiencyLevel.valueOf(rs.getString("proficiency_level")),
              rs.getInt("headcount"));

  private final JdbcTemplate jdbcTemplate;
  private final SimpleJdbcInsert insert;

  /** 주어진 {@link JdbcTemplate}으로 이 저장소를 만든다. */
  public JdbcProjectRequiredSkillLineRepository(JdbcTemplate jdbcTemplate) {
    this.jdbcTemplate = jdbcTemplate;
    this.insert =
        new SimpleJdbcInsert(jdbcTemplate)
            .withTableName("project_required_skill_line")
            .usingGeneratedKeyColumns("id");
  }

  @Override
  public ProjectRequiredSkillLine insert(ProjectRequiredSkillLine line) {
    long id =
        insert
            .executeAndReturnKey(
                Map.of(
                    "project_id", line.projectId(),
                    "job_title", line.jobTitle(),
                    "skill_name", line.skillName(),
                    "proficiency_level", line.proficiencyLevel().name(),
                    "headcount", line.headcount()))
            .longValue();
    return new ProjectRequiredSkillLine(
        id,
        line.projectId(),
        line.jobTitle(),
        line.skillName(),
        line.proficiencyLevel(),
        line.headcount());
  }

  @Override
  public List<ProjectRequiredSkillLine> findByProjectId(long projectId) {
    return jdbcTemplate.query(
        "select id, project_id, job_title, skill_name, proficiency_level, headcount "
            + "from project_required_skill_line where project_id = ?",
        ROW_MAPPER,
        projectId);
  }

  @Override
  public long count() {
    return jdbcTemplate.queryForObject(
        "select count(*) from project_required_skill_line", Long.class);
  }
}
