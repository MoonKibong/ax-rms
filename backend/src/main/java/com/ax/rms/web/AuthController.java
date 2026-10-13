package com.ax.rms.web;

import com.ax.rms.domain.Role;
import com.ax.rms.security.AccountPrincipal;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

/** 로그인·현재 사용자·로그아웃 API(D16). 로그인은 서버 세션에 남는다. */
@RestController
public class AuthController {

  private static final ApiError INVALID_REQUEST =
      new ApiError("AUTH_INVALID_REQUEST", "계정과 비밀번호를 입력하세요.");
  private static final ApiError INVALID_CREDENTIALS =
      new ApiError("AUTH_INVALID_CREDENTIALS", "계정 또는 비밀번호가 올바르지 않습니다.");

  private final AuthenticationManager authenticationManager;
  private final SecurityContextRepository securityContextRepository =
      new HttpSessionSecurityContextRepository();

  /** 주어진 인증 관리자로 만든다. */
  public AuthController(AuthenticationManager authenticationManager) {
    this.authenticationManager = authenticationManager;
  }

  /**
   * 아이디와 비밀번호로 로그인한다. 이미 세션이 있었으면 그 세션을 없애고 새 세션에 로그인을 남긴다(세션 고정 방지).
   *
   * @return 200과 현재 사용자, 400(빈 값), 401(틀린 계정·비밀번호; 없는 계정과 같은 응답)
   */
  @PostMapping(path = "/api/auth/login", consumes = MediaType.APPLICATION_JSON_VALUE)
  public ResponseEntity<Object> login(
      @RequestBody(required = false) LoginRequest body,
      HttpServletRequest request,
      HttpServletResponse response) {
    if (body == null || isBlank(body.username()) || isBlank(body.password())) {
      return ResponseEntity.badRequest().body(INVALID_REQUEST);
    }
    Authentication authentication;
    try {
      Authentication attempt =
          UsernamePasswordAuthenticationToken.unauthenticated(body.username(), body.password());
      authentication = authenticationManager.authenticate(attempt);
    } catch (AuthenticationException e) {
      return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(INVALID_CREDENTIALS);
    }

    HttpSession previous = request.getSession(false);
    if (previous != null) {
      previous.invalidate();
    }
    SecurityContext context = SecurityContextHolder.createEmptyContext();
    context.setAuthentication(authentication);
    SecurityContextHolder.setContext(context);
    securityContextRepository.saveContext(context, request, response);
    return ResponseEntity.ok(CurrentUser.of((AccountPrincipal) authentication.getPrincipal()));
  }

  /** 로그인한 계정을 돌려준다. 로그인하지 않았으면 보안 설정이 401로 막는다. */
  @GetMapping("/api/auth/me")
  public CurrentUser me(@AuthenticationPrincipal AccountPrincipal principal) {
    return CurrentUser.of(principal);
  }

  /** 세션을 없앤다. 그 뒤 같은 쿠키로 보낸 요청은 로그인하지 않은 요청이다. */
  @PostMapping("/api/auth/logout")
  public ResponseEntity<Void> logout(HttpServletRequest request) {
    HttpSession session = request.getSession(false);
    if (session != null) {
      session.invalidate();
    }
    SecurityContextHolder.clearContext();
    return ResponseEntity.noContent().build();
  }

  /** JSON으로 읽을 수 없는 로그인 본문은 빈 값과 같게 400으로 답한다. */
  @ExceptionHandler(HttpMessageNotReadableException.class)
  public ResponseEntity<ApiError> unreadable() {
    return ResponseEntity.badRequest().body(INVALID_REQUEST);
  }

  private static boolean isBlank(String value) {
    return value == null || value.isBlank();
  }

  /** 로그인 요청 본문. */
  public record LoginRequest(String username, String password) {}

  /**
   * 로그인·현재 사용자 응답. 비밀번호와 해시는 넣지 않는다.
   *
   * @param username 아이디
   * @param employeeId 계정과 연결된 직원 ID(D17)
   * @param employeeName 그 직원의 이름
   * @param roles 역할 이름 목록({@code HR_MANAGER}, {@code PROJECT_MANAGER}, {@code EMPLOYEE})
   */
  public record CurrentUser(
      String username, long employeeId, String employeeName, List<String> roles) {

    static CurrentUser of(AccountPrincipal principal) {
      List<String> roles = principal.roles().stream().map(Role::name).toList();
      return new CurrentUser(
          principal.getUsername(), principal.employeeId(), principal.employeeName(), roles);
    }
  }
}
