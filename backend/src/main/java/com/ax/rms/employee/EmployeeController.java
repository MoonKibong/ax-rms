package com.ax.rms.employee;

import com.ax.rms.domain.AvailabilityStatus;
import java.net.URI;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** 직원 목록·상세·등록·수정·상태 변경 API(D2, D6). 권한 검사는 이 태스크의 몫이 아니다(#6, 이슈 #8 PM 결정). */
@RestController
@RequestMapping("/api/employees")
public class EmployeeController {

  private final EmployeeService employeeService;

  /** 주어진 서비스로 이 컨트롤러를 만든다. */
  public EmployeeController(EmployeeService employeeService) {
    this.employeeService = employeeService;
  }

  /** 직원 목록을 검색·필터해 돌려준다. */
  @GetMapping
  public List<EmployeeListItemResponse> list(
      @RequestParam(required = false) String name,
      @RequestParam(required = false) Long departmentId,
      @RequestParam(required = false) String skill,
      @RequestParam(required = false) AvailabilityStatus status,
      @RequestParam(required = false) Integer minAvailability) {
    return employeeService.list(name, departmentId, skill, status, minAvailability);
  }

  /** 직원 상세를 돌려준다. */
  @GetMapping("/{id}")
  public EmployeeDetailResponse detail(@PathVariable long id) {
    return employeeService.detail(id);
  }

  /** 새 직원을 등록한다. */
  @PostMapping
  public ResponseEntity<EmployeeDetailResponse> register(
      @RequestBody EmployeeUpsertRequest request) {
    EmployeeDetailResponse created = employeeService.register(request);
    return ResponseEntity.created(URI.create("/api/employees/" + created.id())).body(created);
  }

  /** 직원 정보와 기술을 수정한다. */
  @PutMapping("/{id}")
  public EmployeeDetailResponse update(
      @PathVariable long id, @RequestBody EmployeeUpsertRequest request) {
    return employeeService.update(id, request);
  }

  /** 직원의 투입 상태를 바꾼다. */
  @PatchMapping("/{id}/status")
  public EmployeeDetailResponse changeStatus(
      @PathVariable long id, @RequestBody EmployeeStatusChangeRequest request) {
    return employeeService.changeStatus(id, request);
  }
}
