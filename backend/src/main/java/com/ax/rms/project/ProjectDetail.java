package com.ax.rms.project;

import com.ax.rms.domain.ProficiencyLevel;
import com.ax.rms.domain.ProjectStatus;
import java.time.LocalDate;
import java.util.List;

/**
 * 프로젝트 상세(D3): 정보, 필요 역량 줄, 인력 현황, 배치 인력과 투입률.
 *
 * @param id 프로젝트 id
 * @param name 프로젝트명
 * @param description 설명(없으면 {@code null})
 * @param startDate 시작일
 * @param endDate 종료일
 * @param status 상태
 * @param requiredSkills 필요 역량 줄(줄 id 오름차순)
 * @param requiredHeadcount 필요 인원: 줄별 인원의 합계(D22)
 * @param assignedHeadcount 오늘 배치된 서로 다른 직원 수
 * @param assignments 전체 배치(시작일, 직원 이름, 배치 id 오름차순)
 */
public record ProjectDetail(
    long id,
    String name,
    String description,
    LocalDate startDate,
    LocalDate endDate,
    ProjectStatus status,
    List<SkillLine> requiredSkills,
    int requiredHeadcount,
    int assignedHeadcount,
    List<AssignedEmployee> assignments) {

  /**
   * 필요 역량 한 줄.
   *
   * @param jobTitle 직무
   * @param skillName 기술
   * @param proficiencyLevel 숙련도
   * @param headcount 인원
   */
  public record SkillLine(
      String jobTitle, String skillName, ProficiencyLevel proficiencyLevel, int headcount) {}

  /**
   * 이 프로젝트에 배치된 직원 한 건.
   *
   * @param assignmentId 배치 id
   * @param employeeId 직원 id
   * @param employeeName 직원 이름
   * @param startDate 투입 시작일
   * @param endDate 투입 종료일
   * @param allocationPercent 투입률
   * @param currentAvailability 그 직원의 현재 가용률(모든 프로젝트 기준, 종료된 프로젝트 제외)
   */
  public record AssignedEmployee(
      long assignmentId,
      long employeeId,
      String employeeName,
      LocalDate startDate,
      LocalDate endDate,
      int allocationPercent,
      int currentAvailability) {}
}
