package com.ax.rms.support;

import java.time.Clock;
import java.time.LocalDate;
import java.time.ZoneOffset;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;

/**
 * 시더와 테스트가 같은 "오늘"을 보도록 {@link Clock} 빈을 고정값으로 바꾼다. {@code FIXED_TODAY}가 그 고정된
 * "오늘"이다 — 시더가 넣은 날짜를 테스트가 기대할 때 이 값을 기준으로 계산한다. 운영 코드의 {@code clock} 빈과
 * 이름이 겹치면 스프링이 빈 재정의를 거부하므로, 다른 이름에 {@code @Primary}를 붙여 타입 기준 주입만 바꾼다.
 */
@Import(AbstractSeedTest.FixedClockConfig.class)
public abstract class AbstractSeedTest extends AbstractDatabaseTest {

  public static final LocalDate FIXED_TODAY = LocalDate.of(2026, 6, 15);

  @TestConfiguration
  static class FixedClockConfig {

    @Bean
    @Primary
    Clock fixedClockForTests() {
      return Clock.fixed(FIXED_TODAY.atStartOfDay(ZoneOffset.UTC).toInstant(), ZoneOffset.UTC);
    }
  }
}
