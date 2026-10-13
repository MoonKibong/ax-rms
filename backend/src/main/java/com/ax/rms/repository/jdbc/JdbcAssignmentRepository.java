package com.ax.rms.repository.jdbc;

import com.ax.rms.domain.Assignment;
import com.ax.rms.repository.AssignmentRepository;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.simple.SimpleJdbcInsert;
import org.springframework.stereotype.Repository;

/** {@link AssignmentRepository}의 JDBC 구현. */
@Repository
public class JdbcAssignmentRepository implements AssignmentRepository {

  private static final RowMapper<Assignment> ROW_MAPPER =
      (rs, rowNum) ->
          new Assignment(
              rs.getLong("id"),
              rs.getLong("employee_id"),
              rs.getLong("project_id"),
              LocalDate.parse(rs.getString("start_date")),
              LocalDate.parse(rs.getString("end_date")),
              rs.getInt("allocation_percent"));

  private final JdbcTemplate jdbcTemplate;
  private final SimpleJdbcInsert insert;

  /** 주어진 {@link JdbcTemplate}으로 이 저장소를 만든다. */
  public JdbcAssignmentRepository(JdbcTemplate jdbcTemplate) {
    this.jdbcTemplate = jdbcTemplate;
    this.insert =
        new SimpleJdbcInsert(jdbcTemplate)
            .withTableName("assignment")
            .usingGeneratedKeyColumns("id");
  }

  @Override
  public Assignment insert(Assignment assignment) {
    long id =
        insert
            .executeAndReturnKey(
                Map.of(
                    "employee_id", assignment.employeeId(),
                    "project_id", assignment.projectId(),
                    "start_date", assignment.startDate().toString(),
                    "end_date", assignment.endDate().toString(),
                    "allocation_percent", assignment.allocationPercent()))
            .longValue();
    return new Assignment(
        id,
        assignment.employeeId(),
        assignment.projectId(),
        assignment.startDate(),
        assignment.endDate(),
        assignment.allocationPercent());
  }

  @Override
  public List<Assignment> findAll() {
    return jdbcTemplate.query(
        "select id, employee_id, project_id, start_date, end_date, allocation_percent "
            + "from assignment order by id",
        ROW_MAPPER);
  }

  @Override
  public List<Assignment> findByEmployeeId(long employeeId) {
    return jdbcTemplate.query(
        "select id, employee_id, project_id, start_date, end_date, allocation_percent "
            + "from assignment where employee_id = ?",
        ROW_MAPPER,
        employeeId);
  }

  @Override
  public Optional<Assignment> findById(long id) {
    return jdbcTemplate
        .query(
            "select id, employee_id, project_id, start_date, end_date, allocation_percent "
                + "from assignment where id = ?",
            ROW_MAPPER,
            id)
        .stream()
        .findFirst();
  }

  @Override
  public void update(Assignment assignment) {
    jdbcTemplate.update(
        "update assignment set start_date = ?, end_date = ?, allocation_percent = ? where id = ?",
        assignment.startDate().toString(),
        assignment.endDate().toString(),
        assignment.allocationPercent(),
        assignment.id());
  }

  @Override
  public void delete(long id) {
    jdbcTemplate.update("delete from assignment where id = ?", id);
  }

  @Override
  public long count() {
    return jdbcTemplate.queryForObject("select count(*) from assignment", Long.class);
  }
}
