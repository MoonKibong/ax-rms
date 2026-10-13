package com.ax.rms.seed;

import static org.assertj.core.api.Assertions.assertThat;

import com.ax.rms.domain.Account;
import com.ax.rms.domain.Role;
import com.ax.rms.repository.AccountRepository;
import com.ax.rms.support.AbstractSeedTest;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.password.PasswordEncoder;

/**
 * README에 적힌 평문 비밀번호가 시드의 BCrypt 해시와 맞는 4개 데모 계정(D31)이 있는지 본다.
 * README.md에 적는 값과 이 테스트의 값은 반드시 같아야 한다.
 */
class DemoAccountTest extends AbstractSeedTest {

  @Autowired private AccountRepository accountRepository;
  @Autowired private PasswordEncoder passwordEncoder;

  @Test
  void hrManagerDemoAccountExists() {
    assertAccount("hr.manager", "HrManager!1", Set.of(Role.EMPLOYEE, Role.HR_MANAGER));
  }

  @Test
  void projectManagerDemoAccountExists() {
    assertAccount(
        "project.manager", "ProjectManager!1", Set.of(Role.EMPLOYEE, Role.PROJECT_MANAGER));
  }

  @Test
  void employeeOnlyDemoAccountExists() {
    assertAccount("employee.demo", "Employee!1", Set.of(Role.EMPLOYEE));
  }

  @Test
  void dualRoleDemoAccountExists() {
    assertAccount(
        "dual.manager",
        "DualManager!1",
        Set.of(Role.EMPLOYEE, Role.HR_MANAGER, Role.PROJECT_MANAGER));
  }

  private void assertAccount(String username, String plainPassword, Set<Role> expectedRoles) {
    Account account = accountRepository.findByUsername(username).orElseThrow(
        () -> new AssertionError("계정이 없다: " + username));
    assertThat(passwordEncoder.matches(plainPassword, account.passwordHash())).isTrue();
    assertThat(accountRepository.findRoles(account.id())).isEqualTo(expectedRoles);
  }
}
