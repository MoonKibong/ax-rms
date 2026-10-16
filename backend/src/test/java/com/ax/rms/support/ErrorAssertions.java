package com.ax.rms.support;

import static org.assertj.core.api.Assertions.assertThat;

import com.ax.rms.support.ApiClient.Response;
import java.util.ArrayList;
import java.util.List;

/** 오류 응답이 D33 형식 {@code {code, message}}인지 확인하는 공용 단언이다. */
public final class ErrorAssertions {

  private ErrorAssertions() {}

  /** 상태와 코드가 맞고, 본문의 키가 {@code code}·{@code message} 둘뿐이며 메시지가 비어 있지 않은지 확인한다. */
  public static void assertError(Response response, int status, String code) {
    assertThat(response.status()).as("상태: %s", response.body()).isEqualTo(status);
    assertThat(response.json().path("code").asText())
        .as("code: %s", response.body())
        .isEqualTo(code);
    List<String> keys = new ArrayList<>();
    response.json().fieldNames().forEachRemaining(keys::add);
    assertThat(keys).as("본문 키: %s", response.body()).containsExactlyInAnyOrder("code", "message");
    assertThat(response.json().path("message").asText()).isNotBlank();
  }
}
