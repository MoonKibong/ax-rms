package com.ax.rms.seed;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.ax.rms.domain.Project;
import com.ax.rms.repository.AccountRepository;
import com.ax.rms.repository.AssignmentRepository;
import com.ax.rms.repository.DepartmentRepository;
import com.ax.rms.repository.EmployeeRepository;
import com.ax.rms.repository.EmployeeSkillRepository;
import com.ax.rms.repository.ProjectRepository;
import com.ax.rms.repository.ProjectRequiredSkillLineRepository;
import com.ax.rms.support.AbstractSeedTest;
import java.time.Clock;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.DefaultApplicationArguments;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.PlatformTransactionManager;

/** 시드 도중 실패하면 전부 롤백되는지 본다(T#54 기준 2, B#4). */
class SeedAtomicityTest extends AbstractSeedTest {

  @Autowired private JdbcTemplate jdbcTemplate;
  @Autowired private DepartmentRepository departmentRepository;
  @Autowired private EmployeeRepository employeeRepository;
  @Autowired private EmployeeSkillRepository employeeSkillRepository;
  @Autowired private ProjectRequiredSkillLineRepository skillLineRepository;
  @Autowired private AssignmentRepository assignmentRepository;
  @Autowired private AccountRepository accountRepository;
  @Autowired private PasswordEncoder passwordEncoder;
  @Autowired private Clock clock;
  @Autowired private PlatformTransactionManager transactionManager;

  @Test
  void oneFailureWhileInsertingProjectsRollsBackDepartmentsAndEmployeesToo() {
    clearAllSeedTables();
    SeedRunner failingRunner =
        new SeedRunner(
            departmentRepository,
            employeeRepository,
            employeeSkillRepository,
            new AlwaysFailingProjectRepository(),
            skillLineRepository,
            assignmentRepository,
            accountRepository,
            passwordEncoder,
            clock,
            transactionManager);

    assertThrows(
        RuntimeException.class, () -> failingRunner.run(new DefaultApplicationArguments()));

    assertThat(departmentRepository.count()).isZero();
    assertThat(employeeRepository.count()).isZero();
  }

  private void clearAllSeedTables() {
    jdbcTemplate.execute("delete from account_role");
    jdbcTemplate.execute("delete from account");
    jdbcTemplate.execute("delete from assignment");
    jdbcTemplate.execute("delete from project_required_skill_line");
    jdbcTemplate.execute("delete from employee_skill");
    jdbcTemplate.execute("delete from project");
    jdbcTemplate.execute("delete from employee");
    jdbcTemplate.execute("delete from department");
  }

  /** 시드 도중 실패를 흉내 내려고 {@code insert}에서 항상 예외를 던진다. */
  static final class AlwaysFailingProjectRepository implements ProjectRepository {
    @Override
    public Project insert(Project project) {
      throw new RuntimeException("T#54 강제 실패: 시드 원자성 재현");
    }

    @Override
    public boolean update(Project project) {
      throw new UnsupportedOperationException();
    }

    @Override
    public List<Project> findAll() {
      return List.of();
    }

    @Override
    public Optional<Project> findById(long id) {
      return Optional.empty();
    }

    @Override
    public long count() {
      return 0;
    }
  }
}
