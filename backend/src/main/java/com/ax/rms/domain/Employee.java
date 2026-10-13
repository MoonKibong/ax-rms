package com.ax.rms.domain;

import java.time.LocalDate;

/** 직원(D2). {@code unavailableReason}과 {@code unavailableUntil}은 투입 불가일 때만 쓴다(D6). */
public record Employee(
    Long id,
    String name,
    long departmentId,
    String jobTitle,
    int careerYears,
    AvailabilityStatus availabilityStatus,
    String unavailableReason,
    LocalDate unavailableUntil) {}
