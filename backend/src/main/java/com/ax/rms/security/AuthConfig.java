package com.ax.rms.security;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.ProviderManager;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.crypto.password.PasswordEncoder;

/** 로그인 API가 쓰는 인증: 계정 표의 BCrypt 해시(D32)와 비밀번호를 비교한다. */
@Configuration
public class AuthConfig {

  /**
   * 아이디와 비밀번호를 확인하는 인증 관리자를 돌려준다. 없는 계정도 틀린 비밀번호와 같은 예외가 되고, 같은 시간만큼
   * 해시를 계산한다.
   */
  @Bean
  public AuthenticationManager authenticationManager(
      AccountUserDetailsService userDetailsService, PasswordEncoder passwordEncoder) {
    DaoAuthenticationProvider provider = new DaoAuthenticationProvider(userDetailsService);
    provider.setPasswordEncoder(passwordEncoder);
    return new ProviderManager(provider);
  }
}
