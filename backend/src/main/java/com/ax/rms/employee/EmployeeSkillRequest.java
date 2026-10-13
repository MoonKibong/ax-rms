package com.ax.rms.employee;

/**
 * 등록·수정 요청의 기술 한 줄. {@code proficiencyLevel}은 문자열로 받아 서비스가 직접 검증한다(유효하지 않으면
 * {@code EMPLOYEE_SKILL_INVALID}).
 */
public record EmployeeSkillRequest(String skillName, String proficiencyLevel) {}
