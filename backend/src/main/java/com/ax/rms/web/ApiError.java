package com.ax.rms.web;

/**
 * API 오류 응답 본문(D33): 원인 코드와 한국어 메시지. 인증·권한 오류부터 쓰고, 이후 API의 규칙 위반도 이 형식을 쓴다.
 *
 * @param code 원인 코드 (예: {@code AUTH_REQUIRED})
 * @param message 사용자에게 보일 한국어 메시지
 */
public record ApiError(String code, String message) {}
