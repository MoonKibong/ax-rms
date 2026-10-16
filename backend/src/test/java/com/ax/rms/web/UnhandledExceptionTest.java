package com.ax.rms.web;

import static com.ax.rms.support.ErrorAssertions.assertError;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.doThrow;

import ch.qos.logback.classic.Level;
import ch.qos.logback.classic.spi.ILoggingEvent;
import com.ax.rms.dashboard.DashboardService;
import com.ax.rms.support.AbstractApiTest;
import com.ax.rms.support.ApiClient;
import com.ax.rms.support.ApiClient.Response;
import com.ax.rms.support.LogCapture;
import org.junit.jupiter.api.Test;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;

/** T#56 기준 4: 처리 안 된 예외는 500 {@code INTERNAL_ERROR}이고 내부 내용을 숨기며 ERROR 로그를 남긴다. */
class UnhandledExceptionTest extends AbstractApiTest {

  @MockitoSpyBean private DashboardService dashboardService;

  @Test
  void unhandledExceptionBecomesInternalErrorAndIsLogged() {
    doThrow(new RuntimeException("boom-secret")).when(dashboardService).dashboard();
    ApiClient hr = client();
    hr.login("hr.manager", "HrManager!1");

    try (LogCapture logs = new LogCapture()) {
      Response response = hr.get("/api/dashboard");

      assertError(response, 500, "INTERNAL_ERROR");
      assertThat(response.body()).doesNotContain("boom-secret").doesNotContain("RuntimeException");
      assertThat(logs.exactly(Level.ERROR))
          .as("ERROR 로그")
          .anyMatch(UnhandledExceptionTest::carriesBoom);
    }
  }

  private static boolean carriesBoom(ILoggingEvent event) {
    return event.getThrowableProxy() != null
        && "boom-secret".equals(event.getThrowableProxy().getMessage());
  }
}
