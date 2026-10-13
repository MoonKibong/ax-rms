package com.ax.rms.employee;

import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

/** {@link EmployeeApiException}을 D33 형식의 JSON 본문으로 바꾼다. */
@RestControllerAdvice
public class EmployeeApiExceptionHandler {

  /** 예외의 상태·코드·메시지로 {@code {"code", "message"}} 응답을 만든다. */
  @ExceptionHandler(EmployeeApiException.class)
  public ResponseEntity<Map<String, String>> handle(EmployeeApiException exception) {
    return ResponseEntity.status(exception.status())
        .body(Map.of("code", exception.code(), "message", exception.getMessage()));
  }
}
