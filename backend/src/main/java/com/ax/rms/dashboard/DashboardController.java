package com.ax.rms.dashboard;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/** 대시보드 집계 API(T#11). 권한은 T#6 보안 설정이 {@code /api/dashboard/**}에서 막는다. */
@RestController
public class DashboardController {

  private final DashboardService service;

  /** 주어진 서비스로 만든다. */
  public DashboardController(DashboardService service) {
    this.service = service;
  }

  /** D5의 아홉 항목을 돌려준다. 성공: 200. */
  @GetMapping("/api/dashboard")
  public DashboardService.DashboardResponse dashboard() {
    return service.dashboard();
  }
}
