package com.ax.rms.employee;

import java.util.List;

/**
 * 등록·수정 공용 요청 본문(D2). 투입 상태 관련 필드는 여기 없다 — 상태는
 * {@code PATCH /api/employees/{id}/status}로만 바꾼다(D6).
 */
public record EmployeeUpsertRequest(
    String name, Long departmentId, String jobTitle, Integer careerYears,
    List<EmployeeSkillRequest> skills) {}
