package com.ax.rms.employee;

import com.ax.rms.domain.ProjectStatus;
import java.time.LocalDate;

/** 직원 상세의 배치 현황 한 줄(D2, D15). 종료된 프로젝트의 배치도 그대로 담는다. */
public record AssignmentSummaryResponse(
    long projectId,
    String projectName,
    ProjectStatus projectStatus,
    LocalDate startDate,
    LocalDate endDate,
    int allocationPercent) {}
