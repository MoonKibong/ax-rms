package com.ax.rms.repository.jdbc;

import com.ax.rms.domain.Account;
import com.ax.rms.domain.Role;
import com.ax.rms.repository.AccountRepository;
import java.util.EnumSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.simple.SimpleJdbcInsert;
import org.springframework.stereotype.Repository;

/** {@link AccountRepository}의 JDBC 구현. */
@Repository
public class JdbcAccountRepository implements AccountRepository {

  private static final RowMapper<Account> ROW_MAPPER =
      (rs, rowNum) ->
          new Account(
              rs.getLong("id"),
              rs.getLong("employee_id"),
              rs.getString("username"),
              rs.getString("password_hash"));

  private final JdbcTemplate jdbcTemplate;
  private final SimpleJdbcInsert insert;

  /** 주어진 {@link JdbcTemplate}으로 이 저장소를 만든다. */
  public JdbcAccountRepository(JdbcTemplate jdbcTemplate) {
    this.jdbcTemplate = jdbcTemplate;
    this.insert =
        new SimpleJdbcInsert(jdbcTemplate).withTableName("account").usingGeneratedKeyColumns("id");
  }

  @Override
  public Account insert(Account account) {
    long id =
        insert
            .executeAndReturnKey(
                Map.of(
                    "employee_id", account.employeeId(),
                    "username", account.username(),
                    "password_hash", account.passwordHash()))
            .longValue();
    return new Account(id, account.employeeId(), account.username(), account.passwordHash());
  }

  @Override
  public void assignRole(long accountId, Role role) {
    jdbcTemplate.update(
        "insert into account_role(account_id, role) values (?, ?)", accountId, role.name());
  }

  @Override
  public Set<Role> findRoles(long accountId) {
    List<String> roles =
        jdbcTemplate.queryForList(
            "select role from account_role where account_id = ?", String.class, accountId);
    Set<Role> result = EnumSet.noneOf(Role.class);
    roles.forEach(r -> result.add(Role.valueOf(r)));
    return result;
  }

  @Override
  public Optional<Account> findByUsername(String username) {
    return jdbcTemplate
        .query(
            "select id, employee_id, username, password_hash from account where username = ?",
            ROW_MAPPER,
            username)
        .stream()
        .findFirst();
  }

  @Override
  public List<Account> findAll() {
    return jdbcTemplate.query(
        "select id, employee_id, username, password_hash from account order by id", ROW_MAPPER);
  }

  @Override
  public long count() {
    return jdbcTemplate.queryForObject("select count(*) from account", Long.class);
  }
}
