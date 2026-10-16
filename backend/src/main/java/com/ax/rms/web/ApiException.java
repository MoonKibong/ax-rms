package com.ax.rms.web;

import org.springframework.http.HttpStatus;

/**
 * 업무 규칙 위반과 없는 리소스를 나르는 공통 예외(D33). 전역 {@link ApiErrorHandler}가 상태·코드·메시지 그대로
 * {@link ApiError} 응답으로 바꾼다.
 */
public class ApiException extends RuntimeException {

  private static final long serialVersionUID = 1L;

  private final HttpStatus status;
  private final String code;

  /**
   * 예외를 만든다.
   *
   * @param status 응답 상태
   * @param code 원인 코드(예: {@code PROJECT_NAME_REQUIRED})
   * @param message 사용자에게 보일 한국어 메시지
   */
  public ApiException(HttpStatus status, String code, String message) {
    super(message);
    this.status = status;
    this.code = code;
  }

  /** 응답 상태를 돌려준다. */
  public HttpStatus status() {
    return status;
  }

  /** 원인 코드를 돌려준다. */
  public String code() {
    return code;
  }
}
