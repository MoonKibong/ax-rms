package com.ax.rms.assignment;

/**
 * 배치 업무 규칙 위반(D8·D14·D27·D28). 컨트롤러가 400과 {@code ApiError}({@code code}·한국어 {@code message}, D33)로
 * 답한다.
 *
 * @param code 원인 코드 (예: {@code ASSIGNMENT_OVER_ALLOCATED})
 * @param message 사용자에게 보일 한국어 메시지
 */
public class AssignmentRuleException extends RuntimeException {

  private final String code;

  /** 주어진 코드와 메시지로 규칙 위반을 만든다. */
  public AssignmentRuleException(String code, String message) {
    super(message);
    this.code = code;
  }

  /** 원인 코드를 돌려준다. */
  public String code() {
    return code;
  }
}
