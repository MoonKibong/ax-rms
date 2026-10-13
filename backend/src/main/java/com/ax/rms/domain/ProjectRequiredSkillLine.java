package com.ax.rms.domain;

/** 프로젝트의 필요 역량 한 줄: 직무·기술·숙련도·인원(D22). */
public record ProjectRequiredSkillLine(
    Long id,
    long projectId,
    String jobTitle,
    String skillName,
    ProficiencyLevel proficiencyLevel,
    int headcount) {}
