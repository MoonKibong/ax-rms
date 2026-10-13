package com.ax.rms.support;

import java.nio.file.Path;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

/**
 * 테스트마다 격리된 임시 SQLite 파일을 쓴다. 작업 폴더의 {@code backend/data/app.db}나 {@code DB_PATH}
 * 환경변수에는 의존하지 않는다. {@code @DirtiesContext}가 없으면 스프링이 똑같은(상속된) 설정으로 보고 이전
 * 테스트 클래스의(이미 삭제된 임시 폴더를 가리키는) 컨텍스트를 그대로 재사용해 버린다.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.NONE)
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
public abstract class AbstractDatabaseTest {

  @TempDir static Path tempDir;

  @DynamicPropertySource
  static void databaseProperties(DynamicPropertyRegistry registry) {
    Path dbFile = tempDir.resolve("test.db");
    registry.add("spring.datasource.url", () -> "jdbc:sqlite:" + dbFile + "?foreign_keys=on");
  }
}
