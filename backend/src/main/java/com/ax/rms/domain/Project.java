package com.ax.rms.domain;

import java.time.LocalDate;

/** 프로젝트(D3). */
public record Project(
    Long id,
    String name,
    String description,
    LocalDate startDate,
    LocalDate endDate,
    ProjectStatus status) {}
