package com.ax.rms.web;

import com.ax.rms.assignment.AssignmentService;
import com.ax.rms.domain.Assignment;
import java.time.LocalDate;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** 배치 생성·수정·해제와 후보 조회 API(T#10). 권한은 T#6 보안 설정이 {@code /api/assignments/**}에서 막는다. */
@RestController
public class AssignmentController {

  private final AssignmentService service;

  /** 주어진 서비스로 만든다. */
  public AssignmentController(AssignmentService service) {
    this.service = service;
  }

  /** 새 배치를 만든다. 성공: 201과 생성된 배치. */
  @PostMapping(path = "/api/assignments", consumes = MediaType.APPLICATION_JSON_VALUE)
  public ResponseEntity<Assignment> create(@RequestBody CreateRequest body) {
    Assignment created =
        service.create(
            body.employeeId(),
            body.projectId(),
            body.startDate(),
            body.endDate(),
            body.allocationPercent());
    return ResponseEntity.status(HttpStatus.CREATED).body(created);
  }

  /** 배치를 부분 수정한다. 성공: 200과 수정된 배치. */
  @PatchMapping(path = "/api/assignments/{id}", consumes = MediaType.APPLICATION_JSON_VALUE)
  public Assignment modify(@PathVariable long id, @RequestBody ModifyRequest body) {
    return service.modify(id, body.allocationPercent(), body.startDate(), body.endDate());
  }

  /** 배치를 해제한다. 성공: 204. */
  @DeleteMapping("/api/assignments/{id}")
  public ResponseEntity<Void> release(@PathVariable long id) {
    service.release(id);
    return ResponseEntity.noContent().build();
  }

  /** 기간의 후보 직원 목록을 돌려준다. 성공: 200. */
  @GetMapping("/api/assignments/candidates")
  public List<AssignmentService.Candidate> candidates(
      @RequestParam long projectId,
      @RequestParam LocalDate startDate,
      @RequestParam LocalDate endDate) {
    return service.candidates(projectId, startDate, endDate);
  }

  /** 배치 생성 요청 본문. */
  public record CreateRequest(
      long employeeId, long projectId, LocalDate startDate, LocalDate endDate,
      int allocationPercent) {}

  /** 배치 수정 요청 본문. 준 것만 수정한다. */
  public record ModifyRequest(Integer allocationPercent, LocalDate startDate, LocalDate endDate) {}
}
