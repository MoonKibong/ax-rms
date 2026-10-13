package com.ax.rms.project;

import com.ax.rms.web.ApiError;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

/**
 * 프로젝트 API 요청의 오류를 {@link ApiError} 형식(D33)으로 답한다. {@code com.ax.rms.project}의 컨트롤러로 범위를 한정하고,
 * 전역 {@code ApiErrorHandler}가 맡는 {@code HttpMediaTypeNotSupportedException}은 다루지 않는다.
 */
@RestControllerAdvice(basePackages = "com.ax.rms.project")
public class ProjectApiErrorHandler {

  private static final ApiError REQUEST_INVALID =
      new ApiError("PROJECT_REQUEST_INVALID", "요청 본문을 읽을 수 없습니다.");

  /** 프로젝트 규칙 위반을 그 상태·코드·메시지로 답한다. */
  @ExceptionHandler(ProjectException.class)
  public ResponseEntity<ApiError> projectError(ProjectException e) {
    return ResponseEntity.status(e.status()).body(new ApiError(e.code(), e.getMessage()));
  }

  /** JSON이 아니거나 읽을 수 없는 본문은 400으로 답한다. */
  @ExceptionHandler(HttpMessageNotReadableException.class)
  public ResponseEntity<ApiError> unreadableBody() {
    return ResponseEntity.badRequest().body(REQUEST_INVALID);
  }
}
