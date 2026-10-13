package com.ax.rms.employee;

import com.ax.rms.domain.AvailabilityStatus;
import java.time.LocalDate;
import java.util.List;

/** 직원 상세 응답(D2). 배치 현황·현재 가용률·확인 필요 여부를 함께 담는다(D7, D15, D18, D19, D21). */
public record EmployeeDetailResponse(
    long id,
    String name,
    long departmentId,
    String departmentName,
    String jobTitle,
    int careerYears,
    AvailabilityStatus availabilityStatus,
    String unavailableReason,
    LocalDate unavailableUntil,
    int currentAvailability,
    boolean needsReview,
    List<EmployeeSkillResponse> skills,
    List<AssignmentSummaryResponse> assignments) {}
