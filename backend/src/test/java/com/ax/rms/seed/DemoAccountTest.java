package com.ax.rms.seed;

import static org.assertj.core.api.Assertions.assertThat;

import com.ax.rms.domain.Account;
import com.ax.rms.domain.Role;
import com.ax.rms.repository.AccountRepository;
import com.ax.rms.support.AbstractSeedTest;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.password.PasswordEncoder;

/**
 * README.md의 "데모 계정(D31)" 표를 직접 읽어, 그 표에 적힌 아이디·평문 비밀번호·역할과 시드의 계정이
 * 정확히 같은지 본다. 값을 이 테스트에 따로 하드코딩하지 않는다 — README가 바뀌면 이 테스트가 읽는 값도
 * 같이 바뀐다.
 */
class DemoAccountTest extends AbstractSeedTest {

  private static final Pattern TABLE_ROW =
      Pattern.compile("^\\|\\s*`([^`]+)`\\s*\\|\\s*`([^`]+)`\\s*\\|\\s*([^|]+?)\\s*\\|$");

  @Autowired private AccountRepository accountRepository;
  @Autowired private PasswordEncoder passwordEncoder;

  @Test
  void everyDemoAccountInReadmeExistsWithTheDocumentedPasswordAndRoles() throws IOException {
    List<ReadmeRow> rows = readDemoAccountTable();
    assertThat(rows).as("README의 데모 계정 표에서 읽은 행").hasSize(4);

    for (ReadmeRow row : rows) {
      Account account =
          accountRepository
              .findByUsername(row.username())
              .orElseThrow(() -> new AssertionError("계정이 없다: " + row.username()));
      assertThat(passwordEncoder.matches(row.plainPassword(), account.passwordHash()))
          .as("%s의 비밀번호", row.username())
          .isTrue();
      assertThat(accountRepository.findRoles(account.id())).as("%s의 역할", row.username()).isEqualTo(
          row.roles());
    }
  }

  private List<ReadmeRow> readDemoAccountTable() throws IOException {
    List<String> lines = Files.readAllLines(Path.of("..", "README.md"));
    List<ReadmeRow> rows = new ArrayList<>();
    boolean inSection = false;
    for (String line : lines) {
      if (line.startsWith("## 데모 계정")) {
        inSection = true;
        continue;
      }
      if (inSection && line.startsWith("## ")) {
        break;
      }
      if (!inSection) {
        continue;
      }
      Matcher matcher = TABLE_ROW.matcher(line.trim());
      if (matcher.matches()) {
        rows.add(
            new ReadmeRow(matcher.group(1), matcher.group(2), parseRoles(matcher.group(3))));
      }
    }
    return rows;
  }

  private Set<Role> parseRoles(String cell) {
    String withoutParenthetical = cell.replaceAll("\\([^)]*\\)", "").trim();
    Set<Role> roles = java.util.EnumSet.noneOf(Role.class);
    for (String token : withoutParenthetical.split(",")) {
      roles.add(toRole(token.trim()));
    }
    return roles;
  }

  private Role toRole(String label) {
    return switch (label) {
      case "직원" -> Role.EMPLOYEE;
      case "인력 관리자" -> Role.HR_MANAGER;
      case "프로젝트 관리자" -> Role.PROJECT_MANAGER;
      default -> throw new IllegalArgumentException("알 수 없는 역할 표기: " + label);
    };
  }

  private record ReadmeRow(String username, String plainPassword, Set<Role> roles) {}
}
