package com.ax.rms.security;

import com.ax.rms.domain.Role;
import com.ax.rms.web.ApiError;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.DispatcherType;
import jakarta.servlet.Filter;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.List;
import org.springframework.boot.autoconfigure.condition.ConditionalOnWebApplication;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.annotation.web.configurers.AuthorizeHttpRequestsConfigurer;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.stereotype.Component;

/**
 * 모든 {@code /api} 요청을 거르는 보안 설정 한 곳(T#6 계약서 "권한 정책").
 *
 * <p>세션 쿠키로 로그인을 유지하고, 401·403은 {@link ApiError} JSON으로 답한다. CSRF 토큰은 쓰지 않는다: 세션 쿠키가
 * {@code SameSite=Strict}라 다른 사이트의 요청에 붙지 않고, 로그인은 JSON만 받는다(D40 로컬 시연).
 *
 * <p>{@code @Bean} 메서드가 아니라 {@link SecurityFilterChain} 타입의 컴포넌트다. {@code @WebMvcTest}는 이 타입의
 * 컴포넌트는 가져오지만 {@code @Configuration}의 {@code @Bean}은 가져오지 않으므로, 이렇게 해야 슬라이스 검사(T#3
 * {@code HealthControllerTest})에서도 같은 규칙으로 {@code /api/health}가 열린다. 웹 서버가 없는 컨텍스트(T#5의 데이터
 * 검사)에는 {@link HttpSecurity}가 없으므로 서블릿 웹 애플리케이션에서만 만든다.
 */
@Component
@ConditionalOnWebApplication(type = ConditionalOnWebApplication.Type.SERVLET)
public class ApiSecurityFilterChain implements SecurityFilterChain {

  static final ApiError REQUIRED = new ApiError("AUTH_REQUIRED", "로그인이 필요합니다.");
  static final ApiError FORBIDDEN = new ApiError("AUTH_FORBIDDEN", "이 작업을 할 권한이 없습니다.");

  private static final String HR_MANAGER = Role.HR_MANAGER.name();
  private static final String PROJECT_MANAGER = Role.PROJECT_MANAGER.name();
  private static final List<HttpMethod> WRITES =
      List.of(HttpMethod.POST, HttpMethod.PUT, HttpMethod.PATCH, HttpMethod.DELETE);

  private final SecurityFilterChain chain;

  /** 주어진 {@link HttpSecurity}로 규칙을 만든다. */
  public ApiSecurityFilterChain(HttpSecurity http, ObjectMapper objectMapper) throws Exception {
    http.csrf(AbstractHttpConfigurer::disable)
        .httpBasic(AbstractHttpConfigurer::disable)
        .formLogin(AbstractHttpConfigurer::disable)
        .logout(AbstractHttpConfigurer::disable)
        .requestCache(AbstractHttpConfigurer::disable)
        .exceptionHandling(
            exceptions ->
                exceptions
                    .authenticationEntryPoint(
                        (request, response, e) -> write(response, objectMapper, 401, REQUIRED))
                    .accessDeniedHandler(
                        (request, response, e) -> write(response, objectMapper, 403, FORBIDDEN)))
        .authorizeHttpRequests(ApiSecurityFilterChain::rules);
    this.chain = http.build();
  }

  /**
   * 계약서 "권한 정책" 표(D9, D25). 직원만 가진 계정은 {@code /api/me/**}(경로에 ID가 없는 본인 데이터)만 읽는다.
   * 관리자 역할이 하나라도 있으면 모든 조회가 열리고, 쓰기는 D9를 따른다. 표에 없는 요청은 막는다.
   */
  private static void rules(
      AuthorizeHttpRequestsConfigurer<HttpSecurity>.AuthorizationManagerRequestMatcherRegistry
          auth) {
    auth
        // Spring의 오류 전달(/error)은 막지 않는다. 허용된 요청의 404·405·400이 그대로 나가게 한다.
        .dispatcherTypeMatchers(DispatcherType.ERROR)
        .permitAll()
        .requestMatchers(HttpMethod.GET, "/api/health")
        .permitAll()
        .requestMatchers(HttpMethod.POST, "/api/auth/login")
        .permitAll()
        .requestMatchers(HttpMethod.GET, "/api/auth/me")
        .authenticated()
        .requestMatchers(HttpMethod.POST, "/api/auth/logout")
        .authenticated()
        .requestMatchers(HttpMethod.GET, "/api/me/**")
        .authenticated()
        .requestMatchers(
            HttpMethod.GET,
            "/api/employees/**",
            "/api/projects/**",
            "/api/assignments/**",
            "/api/dashboard/**")
        .hasAnyRole(HR_MANAGER, PROJECT_MANAGER);
    for (HttpMethod write : WRITES) {
      auth.requestMatchers(write, "/api/employees/**")
          .hasRole(HR_MANAGER)
          .requestMatchers(write, "/api/projects/**", "/api/assignments/**")
          .hasRole(PROJECT_MANAGER);
    }
    auth.anyRequest().denyAll();
  }

  private static void write(
      HttpServletResponse response, ObjectMapper objectMapper, int status, ApiError error)
      throws IOException {
    response.setStatus(status);
    response.setContentType(MediaType.APPLICATION_JSON_VALUE);
    response.setCharacterEncoding(StandardCharsets.UTF_8.name());
    objectMapper.writeValue(response.getOutputStream(), error);
  }

  @Override
  public boolean matches(HttpServletRequest request) {
    return chain.matches(request);
  }

  @Override
  public List<Filter> getFilters() {
    return chain.getFilters();
  }
}
