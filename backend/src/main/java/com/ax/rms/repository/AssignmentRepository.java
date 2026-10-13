package com.ax.rms.repository;

import com.ax.rms.domain.Assignment;
import java.util.List;

/** 배치 저장소. */
public interface AssignmentRepository {

  /** 배치를 저장하고, 생성된 id가 채워진 값을 돌려준다. */
  Assignment insert(Assignment assignment);

  /** 전체 배치를 돌려준다. */
  List<Assignment> findAll();

  /** 그 직원의 배치를 전부 돌려준다. */
  List<Assignment> findByEmployeeId(long employeeId);

  /** 저장된 배치 수를 돌려준다. */
  long count();
}
