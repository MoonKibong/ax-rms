package com.ax.rms.assignment;

/**
 * 배치 API에서 없는 리소스(직원·프로젝트·배치). 컨트롤러가 404와 {@code ApiError}({@code code}·한국어
 * {@code message}, D33)로 답한다.
 *
 * @param code 원인 코드 (예: {@code ASSIGNMENT_NOT_FOUND})
 * @param message 사용자에게 보일 한국어 메시지
 */
public class AssignmentNotFoundException extends RuntimeException {

  private final String code;

  /** 주어진 코드와 메시지로 없는 리소스를 만든다. */
  public AssignmentNotFoundException(String code, String message) {
    super(message);
    this.code = code;
  }

  /** 원인 코드를 돌려준다. */
  public String code() {
    return code;
  }
}
