package com.ax.rms.employee;

import com.ax.rms.web.ApiError;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

/** {@link EmployeeApiException}을 D33 형식의 {@link ApiError} 응답으로 바꾼다(#6의 공용 형식). */
@RestControllerAdvice
public class EmployeeApiExceptionHandler {

  /** 예외의 상태·코드·메시지로 {@link ApiError} 응답을 만든다. */
  @ExceptionHandler(EmployeeApiException.class)
  public ResponseEntity<ApiError> handle(EmployeeApiException exception) {
    return ResponseEntity.status(exception.status())
        .body(new ApiError(exception.code(), exception.getMessage()));
  }
}
