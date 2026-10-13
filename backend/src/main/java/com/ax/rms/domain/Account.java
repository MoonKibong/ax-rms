package com.ax.rms.domain;

/** 로그인 계정(D16). 직원 한 명과 1:1로 연결된다(D17). */
public record Account(Long id, long employeeId, String username, String passwordHash) {}
