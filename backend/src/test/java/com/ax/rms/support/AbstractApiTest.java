package com.ax.rms.support;

import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;

/**
 * 임의 포트로 띄운 실제 서버에 HTTP로 요청하는 검사의 바탕이다. 세션 쿠키, 보안 필터, {@code /error} 전달이 운영과
 * 같게 동작한다. DB와 "오늘"은 {@link AbstractSeedTest}대로 임시 SQLite 파일과 고정 {@code Clock}을 쓴다.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
public abstract class AbstractApiTest extends AbstractSeedTest {

  @LocalServerPort private int port;

  /** 쿠키 없이 시작하는 새 클라이언트를 돌려준다. */
  protected ApiClient client() {
    return new ApiClient(port);
  }
}
