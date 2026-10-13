package com.ax.rms.project;

import java.util.List;

/**
 * 프로젝트 등록·수정 요청 본문(D3, D22). 값은 서비스가 검증하므로 모두 문자열·객체 그대로 받는다.
 *
 * @param name 프로젝트명
 * @param description 설명(선택)
 * @param startDate 시작일 {@code YYYY-MM-DD}
 * @param endDate 종료일 {@code YYYY-MM-DD}
 * @param status 프로젝트 상태 이름(D13)
 * @param requiredSkills 필요 역량 줄(없으면 빈 목록으로 본다)
 */
public record ProjectRequest(
    String name,
    String description,
    String startDate,
    String endDate,
    String status,
    List<SkillLineRequest> requiredSkills) {

  /**
   * 필요 역량 한 줄(D22).
   *
   * @param jobTitle 직무
   * @param skillName 기술
   * @param proficiencyLevel 숙련도 이름
   * @param headcount 인원
   */
  public record SkillLineRequest(
      String jobTitle, String skillName, String proficiencyLevel, Integer headcount) {}
}
