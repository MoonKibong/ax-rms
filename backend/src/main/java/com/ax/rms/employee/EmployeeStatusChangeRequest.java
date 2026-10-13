package com.ax.rms.employee;

import java.time.LocalDate;

/**
 * 상태 변경 요청 본문(D6). {@code availabilityStatus}는 문자열로 받아 서비스가 직접 검증한다(유효하지
 * 않으면 {@code EMPLOYEE_STATUS_INVALID}).
 */
public record EmployeeStatusChangeRequest(
    String availabilityStatus, String unavailableReason, LocalDate unavailableUntil) {}
