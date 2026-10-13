package com.ax.rms.domain;

/** 직원의 기술별 숙련도 한 줄(D2, D11). */
public record EmployeeSkill(
    Long id, long employeeId, String skillName, ProficiencyLevel proficiencyLevel) {}
