package com.ax.rms.repository.jdbc;

import com.ax.rms.domain.Department;
import com.ax.rms.repository.DepartmentRepository;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.simple.SimpleJdbcInsert;
import org.springframework.stereotype.Repository;

/** {@link DepartmentRepository}의 JDBC 구현. */
@Repository
public class JdbcDepartmentRepository implements DepartmentRepository {

  private static final RowMapper<Department> ROW_MAPPER =
      (rs, rowNum) -> new Department(rs.getLong("id"), rs.getString("name"));

  private final JdbcTemplate jdbcTemplate;
  private final SimpleJdbcInsert insert;

  /** 주어진 {@link JdbcTemplate}으로 이 저장소를 만든다. */
  public JdbcDepartmentRepository(JdbcTemplate jdbcTemplate) {
    this.jdbcTemplate = jdbcTemplate;
    this.insert =
        new SimpleJdbcInsert(jdbcTemplate)
            .withTableName("department")
            .usingGeneratedKeyColumns("id");
  }

  @Override
  public Department insert(Department department) {
    long id = insert.executeAndReturnKey(Map.of("name", department.name())).longValue();
    return new Department(id, department.name());
  }

  @Override
  public List<Department> findAll() {
    return jdbcTemplate.query("select id, name from department order by id", ROW_MAPPER);
  }

  @Override
  public Optional<Department> findById(long id) {
    return jdbcTemplate
        .query("select id, name from department where id = ?", ROW_MAPPER, id)
        .stream()
        .findFirst();
  }

  @Override
  public long count() {
    return jdbcTemplate.queryForObject("select count(*) from department", Long.class);
  }
}
