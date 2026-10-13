package com.ax.rms.employee;

import org.springframework.http.HttpStatus;

/** 직원 API 요청이 D33 형식({@code code}, {@code message})의 오류로 끝나야 할 때 던진다. */
public class EmployeeApiException extends RuntimeException {

  private final HttpStatus status;
  private final String code;

  /** 응답 상태, 오류 코드, 한국어 메시지로 이 예외를 만든다. */
  public EmployeeApiException(HttpStatus status, String code, String message) {
    super(message);
    this.status = status;
    this.code = code;
  }

  /** 이 오류가 응답할 HTTP 상태를 돌려준다. */
  public HttpStatus status() {
    return status;
  }

  /** D33 오류 코드를 돌려준다. */
  public String code() {
    return code;
  }
}
