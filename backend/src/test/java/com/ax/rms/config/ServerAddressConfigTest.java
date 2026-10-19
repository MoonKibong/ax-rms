package com.ax.rms.config;

import static org.assertj.core.api.Assertions.assertThat;

import com.ax.rms.support.AbstractDatabaseTest;
import java.net.InetAddress;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.web.ServerProperties;
import org.springframework.boot.test.context.SpringBootTest;

/**
 * 백엔드가 기본으로 로컬호스트에만 열리는지 본다(T#57 기준 1, B#15). {@code ServerProperties} 빈은 실제
 * 웹 서버가 뜰 때만 등록되므로, {@link AbstractDatabaseTest}의 {@code WebEnvironment.NONE}을
 * {@code RANDOM_PORT}로 바꿔 쓴다.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class ServerAddressConfigTest extends AbstractDatabaseTest {

  @Autowired private ServerProperties serverProperties;

  @Test
  void defaultsToLocalhostOnly() throws Exception {
    assertThat(serverProperties.getAddress()).isEqualTo(InetAddress.getByName("127.0.0.1"));
  }
}
