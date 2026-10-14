package com.ax.rms.department;

import com.ax.rms.repository.DepartmentRepository;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 부서 목록 API(D26, T#39). 부서는 시드 데이터로만 제공하고 직원 등록·수정에서 고르므로 조회만 둔다. 권한은
 * {@code ApiSecurityFilterChain}의 관리자 조회 줄이 정한다.
 */
@RestController
@RequestMapping("/api/departments")
public class DepartmentController {

  private final DepartmentRepository departmentRepository;

  /** 주어진 저장소로 이 컨트롤러를 만든다. */
  public DepartmentController(DepartmentRepository departmentRepository) {
    this.departmentRepository = departmentRepository;
  }

  /** 모든 부서를 {@code id} 오름차순으로 돌려준다. */
  @GetMapping
  public List<DepartmentResponse> list() {
    return departmentRepository.findAll().stream()
        .map(department -> new DepartmentResponse(department.id(), department.name()))
        .toList();
  }
}
