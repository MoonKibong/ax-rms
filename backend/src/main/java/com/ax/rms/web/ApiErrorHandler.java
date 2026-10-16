package com.ax.rms.web;

import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.context.request.WebRequest;
import org.springframework.web.servlet.mvc.method.annotation.ResponseEntityExceptionHandler;

/**
 * 모든 API 오류를 {@link ApiError} 형식(D33)으로 답하는 단 하나의 처리기다. 업무 오류({@link ApiException}), Spring MVC가
 * 요청을 읽다 낸 표준 예외(400·404·405·415 등), {@code SQLITE_BUSY}(409), 처리 안 된 예외(500)를 모두 여기서 맡는다.
 * 인증·권한 예외는 삼키지 않고 보안 설정이 답하게 다시 던진다.
 */
@RestControllerAdvice
public class ApiErrorHandler extends ResponseEntityExceptionHandler {

  private static final Logger LOG = LoggerFactory.getLogger(ApiErrorHandler.class);

  /** SQLite 결과 코드 {@code SQLITE_BUSY}(5). 확장 코드는 아래 8비트가 이 값이다. */
  private static final int SQLITE_BUSY = 5;

  private static final ApiError REQUEST_INVALID =
      new ApiError("REQUEST_INVALID", "요청 형식이 올바르지 않습니다.");
  private static final ApiError UNSUPPORTED_MEDIA_TYPE =
      new ApiError("UNSUPPORTED_MEDIA_TYPE", "요청 본문은 JSON으로 보내야 합니다.");
  private static final ApiError NOT_FOUND = new ApiError("NOT_FOUND", "요청한 주소를 찾을 수 없습니다.");
  private static final ApiError METHOD_NOT_ALLOWED =
      new ApiError("METHOD_NOT_ALLOWED", "지원하지 않는 요청 방식입니다.");
  private static final ApiError NOT_ACCEPTABLE =
      new ApiError("NOT_ACCEPTABLE", "요청한 형식으로 답할 수 없습니다.");
  private static final ApiError DB_BUSY =
      new ApiError("DB_BUSY", "다른 작업이 처리 중입니다. 잠시 후 다시 시도하세요.");
  private static final ApiError INTERNAL_ERROR =
      new ApiError("INTERNAL_ERROR", "서버 오류가 발생했습니다. 잠시 후 다시 시도하세요.");

  /** 업무 규칙 위반과 없는 리소스를 그 상태·코드·메시지로 답한다. */
  @ExceptionHandler(ApiException.class)
  public ResponseEntity<ApiError> apiError(ApiException e) {
    return ResponseEntity.status(e.status()).body(new ApiError(e.code(), e.getMessage()));
  }

  /**
   * 위에서 맡지 않은 예외를 답한다. {@code SQLITE_BUSY}면 409(경고 로그), 그 밖에는 500(오류 로그)이고 본문에는 내부
   * 내용을 담지 않는다.
   */
  @ExceptionHandler(Exception.class)
  public ResponseEntity<ApiError> unexpected(Exception e, HttpServletRequest request)
      throws Exception {
    if (e instanceof AccessDeniedException || e instanceof AuthenticationException) {
      throw e;
    }
    if (isSqliteBusy(e)) {
      LOG.warn("SQLite가 사용 중이라 요청을 처리하지 못했다: {} {}", request.getMethod(), request.getRequestURI());
      return ResponseEntity.status(HttpStatus.CONFLICT).body(DB_BUSY);
    }
    LOG.error("처리되지 않은 예외: {} {}", request.getMethod(), request.getRequestURI(), e);
    return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(INTERNAL_ERROR);
  }

  /** Spring MVC 표준 예외는 Spring이 정한 상태를 지키고 본문만 {@link ApiError}로 바꾼다. */
  @Override
  protected ResponseEntity<Object> handleExceptionInternal(
      Exception ex,
      Object body,
      HttpHeaders headers,
      HttpStatusCode statusCode,
      WebRequest request) {
    if (statusCode.is5xxServerError()) {
      LOG.error("요청 처리 중 서버 오류", ex);
    }
    return ResponseEntity.status(statusCode).headers(headers).body(errorFor(statusCode));
  }

  private static ApiError errorFor(HttpStatusCode status) {
    return switch (status.value()) {
      case 404 -> NOT_FOUND;
      case 405 -> METHOD_NOT_ALLOWED;
      case 406 -> NOT_ACCEPTABLE;
      case 415 -> UNSUPPORTED_MEDIA_TYPE;
      default -> status.is5xxServerError() ? INTERNAL_ERROR : REQUEST_INVALID;
    };
  }

  private static boolean isSqliteBusy(Throwable error) {
    for (Throwable t = error; t != null; t = t.getCause()) {
      if (t instanceof org.sqlite.SQLiteException sqlite
          && (sqlite.getErrorCode() & 0xFF) == SQLITE_BUSY) {
        return true;
      }
      if (t.getCause() == t) {
        break;
      }
    }
    return false;
  }
}
