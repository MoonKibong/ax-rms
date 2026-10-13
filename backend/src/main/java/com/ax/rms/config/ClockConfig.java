package com.ax.rms.config;

import java.time.Clock;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/** "오늘"(D19)을 구하는 기준 시계. 테스트는 이 빈을 고정된 {@link Clock}으로 바꿔 쓴다. */
@Configuration
public class ClockConfig {

  /** 시스템 기본 시간대의 현재 시계를 돌려준다. */
  @Bean
  public Clock clock() {
    return Clock.systemDefaultZone();
  }
}
