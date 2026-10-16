package com.ax.rms.security;

import static com.ax.rms.support.ErrorAssertions.assertError;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doThrow;

import ch.qos.logback.classic.Level;
import com.ax.rms.repository.AccountRepository;
import com.ax.rms.support.AbstractApiTest;
import com.ax.rms.support.ApiClient;
import com.ax.rms.support.LogCapture;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataAccessResourceFailureException;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;

/** T#56 기준 9: 로그인 중 저장소 오류는 401로 가려지지 않고 500이다. 틀린 비밀번호는 그대로 401이다. */
class LoginInternalErrorTest extends AbstractApiTest {

  @MockitoSpyBean private AccountRepository accountRepository;

  @Test
  void repositoryFailureDuringLoginIsInternalError() {
    doThrow(new DataAccessResourceFailureException("db-down"))
        .when(accountRepository)
        .findByUsername(anyString());

    try (LogCapture logs = new LogCapture()) {
      assertError(client().login("hr.manager", "HrManager!1"), 500, "INTERNAL_ERROR");
      assertThat(logs.exactly(Level.ERROR)).as("ERROR 로그").isNotEmpty();
    }
  }

  @Test
  void wrongPasswordIsStillUnauthorized() {
    ApiClient client = client();
    assertError(client.login("hr.manager", "wrong-password"), 401, "AUTH_INVALID_CREDENTIALS");
  }
}
