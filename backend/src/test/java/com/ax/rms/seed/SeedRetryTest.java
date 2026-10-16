package com.ax.rms.seed;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.ax.rms.repository.AccountRepository;
import com.ax.rms.repository.AssignmentRepository;
import com.ax.rms.repository.DepartmentRepository;
import com.ax.rms.repository.EmployeeRepository;
import com.ax.rms.repository.EmployeeSkillRepository;
import com.ax.rms.repository.ProjectRepository;
import com.ax.rms.repository.ProjectRequiredSkillLineRepository;
import com.ax.rms.support.AbstractSeedTest;
import java.time.Clock;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.DefaultApplicationArguments;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.PlatformTransactionManager;

/** 시드 실패 뒤 다시 실행하면 처음부터 정상으로 들어가는지 본다(T#54 기준 3, B#4). */
class SeedRetryTest extends AbstractSeedTest {

  @Autowired private JdbcTemplate jdbcTemplate;
  @Autowired private DepartmentRepository departmentRepository;
  @Autowired private EmployeeRepository employeeRepository;
  @Autowired private EmployeeSkillRepository employeeSkillRepository;
  @Autowired private ProjectRepository projectRepository;
  @Autowired private ProjectRequiredSkillLineRepository skillLineRepository;
  @Autowired private AssignmentRepository assignmentRepository;
  @Autowired private AccountRepository accountRepository;
  @Autowired private PasswordEncoder passwordEncoder;
  @Autowired private Clock clock;
  @Autowired private PlatformTransactionManager transactionManager;

  @Test
  void retryingAfterOneFailureSeedsEverythingFromScratch() {
    clearAllSeedTables();
    SeedRunner failingRunner =
        new SeedRunner(
            departmentRepository,
            employeeRepository,
            employeeSkillRepository,
            new SeedAtomicityTest.AlwaysFailingProjectRepository(),
            skillLineRepository,
            assignmentRepository,
            accountRepository,
            passwordEncoder,
            clock,
            transactionManager);
    assertThrows(
        RuntimeException.class, () -> failingRunner.run(new DefaultApplicationArguments()));

    SeedRunner workingRunner =
        new SeedRunner(
            departmentRepository,
            employeeRepository,
            employeeSkillRepository,
            projectRepository,
            skillLineRepository,
            assignmentRepository,
            accountRepository,
            passwordEncoder,
            clock,
            transactionManager);
    workingRunner.run(new DefaultApplicationArguments());

    assertThat(departmentRepository.count()).isEqualTo(3);
    assertThat(employeeRepository.count()).isEqualTo(20);
    assertThat(projectRepository.count()).isEqualTo(5);
    assertThat(assignmentRepository.count()).isEqualTo(15);
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
}
