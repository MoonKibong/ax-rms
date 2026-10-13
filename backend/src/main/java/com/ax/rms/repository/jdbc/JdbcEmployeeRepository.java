package com.ax.rms.repository.jdbc;

import com.ax.rms.domain.AvailabilityStatus;
import com.ax.rms.domain.Employee;
import com.ax.rms.repository.EmployeeRepository;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.simple.SimpleJdbcInsert;
import org.springframework.stereotype.Repository;

/** {@link EmployeeRepository}의 JDBC 구현. */
@Repository
public class JdbcEmployeeRepository implements EmployeeRepository {

  private static final RowMapper<Employee> ROW_MAPPER =
      (rs, rowNum) ->
          new Employee(
              rs.getLong("id"),
              rs.getString("name"),
              rs.getLong("department_id"),
              rs.getString("job_title"),
              rs.getInt("career_years"),
              AvailabilityStatus.valueOf(rs.getString("availability_status")),
              rs.getString("unavailable_reason"),
              rs.getString("unavailable_until") == null
                  ? null
                  : LocalDate.parse(rs.getString("unavailable_until")));

  private final JdbcTemplate jdbcTemplate;
  private final SimpleJdbcInsert insert;

  /** 주어진 {@link JdbcTemplate}으로 이 저장소를 만든다. */
  public JdbcEmployeeRepository(JdbcTemplate jdbcTemplate) {
    this.jdbcTemplate = jdbcTemplate;
    this.insert =
        new SimpleJdbcInsert(jdbcTemplate).withTableName("employee").usingGeneratedKeyColumns("id");
  }

  @Override
  public Employee insert(Employee employee) {
    Map<String, Object> params = new HashMap<>();
    params.put("name", employee.name());
    params.put("department_id", employee.departmentId());
    params.put("job_title", employee.jobTitle());
    params.put("career_years", employee.careerYears());
    params.put("availability_status", employee.availabilityStatus().name());
    params.put("unavailable_reason", employee.unavailableReason());
    params.put(
        "unavailable_until",
        employee.unavailableUntil() == null ? null : employee.unavailableUntil().toString());
    long id = insert.executeAndReturnKey(params).longValue();
    return new Employee(
        id,
        employee.name(),
        employee.departmentId(),
        employee.jobTitle(),
        employee.careerYears(),
        employee.availabilityStatus(),
        employee.unavailableReason(),
        employee.unavailableUntil());
  }

  @Override
  public void update(Employee employee) {
    jdbcTemplate.update(
        "update employee set name = ?, department_id = ?, job_title = ?, career_years = ?, "
            + "availability_status = ?, unavailable_reason = ?, unavailable_until = ? where id = ?",
        employee.name(),
        employee.departmentId(),
        employee.jobTitle(),
        employee.careerYears(),
        employee.availabilityStatus().name(),
        employee.unavailableReason(),
        employee.unavailableUntil() == null ? null : employee.unavailableUntil().toString(),
        employee.id());
  }

  @Override
  public List<Employee> findAll() {
    return jdbcTemplate.query(
        "select id, name, department_id, job_title, career_years, availability_status, "
            + "unavailable_reason, unavailable_until from employee order by id",
        ROW_MAPPER);
  }

  @Override
  public Optional<Employee> findById(long id) {
    return jdbcTemplate
        .query(
            "select id, name, department_id, job_title, career_years, availability_status, "
                + "unavailable_reason, unavailable_until from employee where id = ?",
            ROW_MAPPER,
            id)
        .stream()
        .findFirst();
  }

  @Override
  public long count() {
    return jdbcTemplate.queryForObject("select count(*) from employee", Long.class);
  }
}
