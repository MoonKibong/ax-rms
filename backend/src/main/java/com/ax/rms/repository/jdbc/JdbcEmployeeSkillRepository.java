package com.ax.rms.repository.jdbc;

import com.ax.rms.domain.EmployeeSkill;
import com.ax.rms.domain.ProficiencyLevel;
import com.ax.rms.repository.EmployeeSkillRepository;
import java.util.List;
import java.util.Map;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.simple.SimpleJdbcInsert;
import org.springframework.stereotype.Repository;

/** {@link EmployeeSkillRepository}의 JDBC 구현. */
@Repository
public class JdbcEmployeeSkillRepository implements EmployeeSkillRepository {

  private static final RowMapper<EmployeeSkill> ROW_MAPPER =
      (rs, rowNum) ->
          new EmployeeSkill(
              rs.getLong("id"),
              rs.getLong("employee_id"),
              rs.getString("skill_name"),
              ProficiencyLevel.valueOf(rs.getString("proficiency_level")));

  private final JdbcTemplate jdbcTemplate;
  private final SimpleJdbcInsert insert;

  /** 주어진 {@link JdbcTemplate}으로 이 저장소를 만든다. */
  public JdbcEmployeeSkillRepository(JdbcTemplate jdbcTemplate) {
    this.jdbcTemplate = jdbcTemplate;
    this.insert =
        new SimpleJdbcInsert(jdbcTemplate)
            .withTableName("employee_skill")
            .usingGeneratedKeyColumns("id");
  }

  @Override
  public EmployeeSkill insert(EmployeeSkill employeeSkill) {
    long id =
        insert
            .executeAndReturnKey(
                Map.of(
                    "employee_id", employeeSkill.employeeId(),
                    "skill_name", employeeSkill.skillName(),
                    "proficiency_level", employeeSkill.proficiencyLevel().name()))
            .longValue();
    return new EmployeeSkill(
        id,
        employeeSkill.employeeId(),
        employeeSkill.skillName(),
        employeeSkill.proficiencyLevel());
  }

  @Override
  public List<EmployeeSkill> findByEmployeeId(long employeeId) {
    return jdbcTemplate.query(
        "select id, employee_id, skill_name, proficiency_level "
            + "from employee_skill where employee_id = ?",
        ROW_MAPPER,
        employeeId);
  }

  @Override
  public List<EmployeeSkill> findAll() {
    return jdbcTemplate.query(
        "select id, employee_id, skill_name, proficiency_level from employee_skill", ROW_MAPPER);
  }

  @Override
  public void deleteByEmployeeId(long employeeId) {
    jdbcTemplate.update("delete from employee_skill where employee_id = ?", employeeId);
  }

  @Override
  public long count() {
    return jdbcTemplate.queryForObject("select count(*) from employee_skill", Long.class);
  }
}
