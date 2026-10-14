package com.ax.rms.employee;

import com.ax.rms.domain.AvailabilityStatus;
import java.util.List;

/**
 * 직원 목록 한 줄(D2). 현재 가용률과 확인 필요 여부는 조회 시점에 계산한다(D7, D18, D19, D21). {@code skills}는 그
 * 직원의 기술 줄 전부를 저장 순서({@code employee_skill.id} 오름차순)로 담는다(T#13).
 */
public record EmployeeListItemResponse(
    long id,
    String name,
    long departmentId,
    String departmentName,
    String jobTitle,
    int careerYears,
    AvailabilityStatus availabilityStatus,
    int currentAvailability,
    boolean needsReview,
    List<EmployeeSkillResponse> skills) {}
