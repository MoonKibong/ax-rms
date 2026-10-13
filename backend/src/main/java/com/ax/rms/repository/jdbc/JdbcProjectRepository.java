package com.ax.rms.repository.jdbc;

import com.ax.rms.domain.Project;
import com.ax.rms.domain.ProjectStatus;
import com.ax.rms.repository.ProjectRepository;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.simple.SimpleJdbcInsert;
import org.springframework.stereotype.Repository;

/** {@link ProjectRepository}의 JDBC 구현. */
@Repository
public class JdbcProjectRepository implements ProjectRepository {

  private static final RowMapper<Project> ROW_MAPPER =
      (rs, rowNum) ->
          new Project(
              rs.getLong("id"),
              rs.getString("name"),
              rs.getString("description"),
              LocalDate.parse(rs.getString("start_date")),
              LocalDate.parse(rs.getString("end_date")),
              ProjectStatus.valueOf(rs.getString("status")));

  private final JdbcTemplate jdbcTemplate;
  private final SimpleJdbcInsert insert;

  /** 주어진 {@link JdbcTemplate}으로 이 저장소를 만든다. */
  public JdbcProjectRepository(JdbcTemplate jdbcTemplate) {
    this.jdbcTemplate = jdbcTemplate;
    this.insert =
        new SimpleJdbcInsert(jdbcTemplate).withTableName("project").usingGeneratedKeyColumns("id");
  }

  @Override
  public Project insert(Project project) {
    long id =
        insert
            .executeAndReturnKey(
                Map.of(
                    "name", project.name(),
                    "description", project.description() == null ? "" : project.description(),
                    "start_date", project.startDate().toString(),
                    "end_date", project.endDate().toString(),
                    "status", project.status().name()))
            .longValue();
    return new Project(
        id,
        project.name(),
        project.description(),
        project.startDate(),
        project.endDate(),
        project.status());
  }

  @Override
  public List<Project> findAll() {
    return jdbcTemplate.query(
        "select id, name, description, start_date, end_date, status from project order by id",
        ROW_MAPPER);
  }

  @Override
  public Optional<Project> findById(long id) {
    return jdbcTemplate
        .query(
            "select id, name, description, start_date, end_date, status from project where id = ?",
            ROW_MAPPER,
            id)
        .stream()
        .findFirst();
  }

  @Override
  public long count() {
    return jdbcTemplate.queryForObject("select count(*) from project", Long.class);
  }
}
