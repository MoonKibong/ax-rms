package com.ax.rms.employee;

import com.ax.rms.security.AccountPrincipal;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 로그인한 계정의 "내 정보"(D24, D25): 그 계정과 연결된 직원의 상세(D17). 직원 ID는 세션에서만 읽고 요청에서 받지
 * 않으므로 다른 사람의 상세를 고를 수 없다. 권한은 #6의 보안 설정이 정한다({@code GET /api/me/**}는 로그인 필요).
 */
@RestController
public class MeEmployeeController {

  private final EmployeeService employeeService;

  /** 주어진 서비스로 이 컨트롤러를 만든다. */
  public MeEmployeeController(EmployeeService employeeService) {
    this.employeeService = employeeService;
  }

  /** 로그인한 계정에 연결된 직원의 상세를 #8의 직원 상세와 같은 모양으로 돌려준다. */
  @GetMapping("/api/me/employee")
  public EmployeeDetailResponse me(@AuthenticationPrincipal AccountPrincipal principal) {
    return employeeService.detail(principal.employeeId());
  }
}
