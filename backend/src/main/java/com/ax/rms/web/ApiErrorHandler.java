package com.ax.rms.web;

import com.ax.rms.assignment.AssignmentNotFoundException;
import com.ax.rms.assignment.AssignmentRuleException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.HttpMediaTypeNotSupportedException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

/**
 * 처리기를 고르는 단계에서 나는 오류도 {@link ApiError} 형식(D33)으로 답한다. 예를 들어 JSON만 받는 API에 다른
 * {@code Content-Type}으로 보내면, 처리기가 정해지기 전에 거부되므로 컨트롤러의 {@code @ExceptionHandler}가 닿지 않는다.
 */
@RestControllerAdvice
public class ApiErrorHandler {

  private static final ApiError UNSUPPORTED_MEDIA_TYPE =
      new ApiError("UNSUPPORTED_MEDIA_TYPE", "요청 본문은 JSON으로 보내야 합니다.");

  /** 지원하지 않는 {@code Content-Type}은 415로 답한다. */
  @ExceptionHandler(HttpMediaTypeNotSupportedException.class)
  public ResponseEntity<ApiError> unsupportedMediaType() {
    return ResponseEntity.status(HttpStatus.UNSUPPORTED_MEDIA_TYPE).body(UNSUPPORTED_MEDIA_TYPE);
  }

  /** 배치 업무 규칙 위반(D8·D14·D27·D28)은 400으로 답한다. */
  @ExceptionHandler(AssignmentRuleException.class)
  public ResponseEntity<ApiError> ruleViolation(AssignmentRuleException e) {
    return ResponseEntity.badRequest().body(new ApiError(e.code(), e.getMessage()));
  }

  /** 배치 API에서 없는 리소스는 404로 답한다. */
  @ExceptionHandler(AssignmentNotFoundException.class)
  public ResponseEntity<ApiError> notFound(AssignmentNotFoundException e) {
    return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new ApiError(e.code(), e.getMessage()));
  }
}
