package com.ax.rms.department;

/** 부서 목록 응답의 한 항목(D26). 직원 등록·수정 폼의 선택지다. */
public record DepartmentResponse(long id, String name) {}
