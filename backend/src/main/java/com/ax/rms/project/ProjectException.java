package com.ax.rms.project;

import org.springframework.http.HttpStatus;

/** 프로젝트 API의 규칙 위반과 없는 리소스. 원인 코드와 한국어 메시지를 나른다(D33). */
public class ProjectException extends RuntimeException {

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
  public ProjectException(HttpStatus status, String code, String message) {
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
