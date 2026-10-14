package com.ax.rms.repository;

import com.ax.rms.domain.Assignment;
import java.util.List;
import java.util.Optional;

/** 배치 저장소. */
public interface AssignmentRepository {

  /** 배치를 저장하고, 생성된 id가 채워진 값을 돌려준다. */
  Assignment insert(Assignment assignment);

  /** 전체 배치를 돌려준다. */
  List<Assignment> findAll();

  /** 그 직원의 배치를 전부 돌려준다. */
  List<Assignment> findByEmployeeId(long employeeId);

  /** 그 프로젝트의 배치를 전부 돌려준다. */
  List<Assignment> findByProjectId(long projectId);

  /** 주어진 id로 배치를 찾는다. */
  Optional<Assignment> findById(long id);

  /** 배치를 저장된 값으로 덮어쓴다. */
  void update(Assignment assignment);

  /** 배치를 지운다. 없으면 아무 일도 일어나지 않는다. */
  void delete(long id);

  /** 저장된 배치 수를 돌려준다. */
  long count();
}
