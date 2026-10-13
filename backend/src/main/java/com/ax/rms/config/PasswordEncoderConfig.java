package com.ax.rms.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

/** 비밀번호를 해시로 저장하기 위한 인코더(D32). */
@Configuration
public class PasswordEncoderConfig {

  /** BCrypt로 비밀번호를 해시하는 인코더를 돌려준다. */
  @Bean
  public PasswordEncoder passwordEncoder() {
    return new BCryptPasswordEncoder();
  }
}
