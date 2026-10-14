package com.ax.rms.assignment;

import com.ax.rms.web.ApiError;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

/**
 * 배치 API 요청의 오류를 {@link ApiError} 형식(D33)으로 답한다. {@code com.ax.rms.assignment}의 컨트롤러로 범위를 한정하고,
 * 전역 {@code ApiErrorHandler}가 맡는 {@code HttpMediaTypeNotSupportedException}은 다루지 않는다.
 */
@RestControllerAdvice(basePackages = "com.ax.rms.assignment")
public class AssignmentApiErrorHandler {

  private static final ApiError REQUEST_INVALID =
      new ApiError("ASSIGNMENT_REQUEST_INVALID", "요청 형식이 올바르지 않습니다.");

  /** 배치 업무 규칙 위반(D8·D14·D27·D28)은 400으로 답한다. */
  @ExceptionHandler(AssignmentRuleException.class)
  public ResponseEntity<ApiError> ruleViolation(AssignmentRuleException e) {
    return ResponseEntity.badRequest().body(new ApiError(e.code(), e.getMessage()));
  }

  /** 없는 배치·직원·프로젝트는 404로 답한다. */
  @ExceptionHandler(AssignmentNotFoundException.class)
  public ResponseEntity<ApiError> notFound(AssignmentNotFoundException e) {
    return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new ApiError(e.code(), e.getMessage()));
  }

  /** 읽을 수 없는 본문, 형식이 틀린 경로·질의 값, 빠진 질의 값은 400으로 답한다. */
  @ExceptionHandler({
    HttpMessageNotReadableException.class,
    MethodArgumentTypeMismatchException.class,
    MissingServletRequestParameterException.class
  })
  public ResponseEntity<ApiError> malformedRequest() {
    return ResponseEntity.badRequest().body(REQUEST_INVALID);
  }
}
