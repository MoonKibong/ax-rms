package com.ax.rms.project;

import com.ax.rms.domain.ProjectStatus;
import java.time.LocalDate;

/**
 * 프로젝트 목록의 한 항목(D3).
 *
 * @param id 프로젝트 id
 * @param name 프로젝트명
 * @param startDate 시작일
 * @param endDate 종료일
 * @param status 상태
 * @param requiredHeadcount 필요 인원: 줄별 인원의 합계(D22)
 * @param assignedHeadcount 오늘 배치된 서로 다른 직원 수
 */
public record ProjectSummary(
    long id,
    String name,
    LocalDate startDate,
    LocalDate endDate,
    ProjectStatus status,
    int requiredHeadcount,
    int assignedHeadcount) {}
