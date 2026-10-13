package com.ax.rms.employee;

import com.ax.rms.domain.ProficiencyLevel;

/** 직원 상세 응답에 담는 기술 한 줄(D2, D11). */
public record EmployeeSkillResponse(String skillName, ProficiencyLevel proficiencyLevel) {}
