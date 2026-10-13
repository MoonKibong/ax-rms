package com.ax.rms.support;

import com.ax.rms.availability.AvailabilityCalculator;
import com.ax.rms.repository.AssignmentRepository;
import com.ax.rms.repository.EmployeeRepository;
import com.ax.rms.repository.ProjectRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;

/**
 * 임의 포트로 띄운 실제 서버에 HTTP로 요청하는 검사의 바탕이다. 세션 쿠키, 보안 필터, {@code /error} 전달이 운영과
 * 같게 동작한다. DB와 "오늘"은 {@link AbstractSeedTest}대로 임시 SQLite 파일과 고정 {@code Clock}을 쓴다.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
public abstract class AbstractApiTest extends AbstractSeedTest {

  @LocalServerPort private int port;

  @Autowired private AssignmentRepository assignmentRepository;

  @Autowired private EmployeeRepository employeeRepository;

  @Autowired private ProjectRepository projectRepository;

  /** 쿠키 없이 시작하는 새 클라이언트를 돌려준다. */
  public ApiClient client() {
    return new ApiClient(port);
  }

  /** 요청 후 DB 상태를 확인하는 데 쓰는 배치 저장소다. */
  public AssignmentRepository assignmentRepository() {
    return assignmentRepository;
  }

  /** 이름으로 직원을 찾는 데 쓰는 직원 저장소다. */
  public EmployeeRepository employeeRepository() {
    return employeeRepository;
  }

  /** 이름으로 프로젝트를 찾는 데 쓰는 프로젝트 저장소다. */
  public ProjectRepository projectRepository() {
    return projectRepository;
  }

  /** T#7의 순수 가용률 계산기를 돌려준다. */
  public AvailabilityCalculator calculator() {
    return new AvailabilityCalculator();
  }
}
