package com.ax.rms.project;

import java.net.URI;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** 프로젝트 목록·상세·등록·수정 API(D3). 권한은 보안 설정이 경로·메서드로 정한다(T#6). */
@RestController
@RequestMapping("/api/projects")
public class ProjectController {

  private final ProjectService service;

  /** 서비스로 컨트롤러를 만든다. */
  public ProjectController(ProjectService service) {
    this.service = service;
  }

  /** 프로젝트 목록. {@code status}가 있으면 그 상태만 돌려준다. */
  @GetMapping
  public List<ProjectSummary> list(@RequestParam(required = false) String status) {
    return service.list(status);
  }

  /** 프로젝트 상세. */
  @GetMapping("/{id}")
  public ProjectDetail detail(@PathVariable long id) {
    return service.detail(id);
  }

  /** 프로젝트를 등록한다. 201과 {@code Location}으로 답한다. */
  @PostMapping
  public ResponseEntity<ProjectDetail> create(@RequestBody ProjectRequest request) {
    ProjectDetail created = service.create(request);
    return ResponseEntity.created(URI.create("/api/projects/" + created.id())).body(created);
  }

  /** 프로젝트를 수정한다. 필요 역량 줄은 요청의 목록으로 통째로 바꾼다. */
  @PutMapping("/{id}")
  public ProjectDetail update(@PathVariable long id, @RequestBody ProjectRequest request) {
    return service.update(id, request);
  }
}
