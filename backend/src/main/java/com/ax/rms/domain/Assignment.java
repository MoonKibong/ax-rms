package com.ax.rms.domain;

import java.time.LocalDate;

/** 직원의 프로젝트 배치 한 건(D4). {@code allocationPercent}는 5~100의 5 단위다(D14). */
public record Assignment(
    Long id,
    long employeeId,
    long projectId,
    LocalDate startDate,
    LocalDate endDate,
    int allocationPercent) {}
