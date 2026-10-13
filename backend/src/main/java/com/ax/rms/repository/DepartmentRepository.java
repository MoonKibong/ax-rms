package com.ax.rms.repository;

import com.ax.rms.domain.Department;
import java.util.List;
import java.util.Optional;

/** 부서 저장소. */
public interface DepartmentRepository {

  /** 부서를 저장하고, 생성된 id가 채워진 값을 돌려준다. */
  Department insert(Department department);

  /** 전체 부서를 돌려준다. */
  List<Department> findAll();

  /** 주어진 id로 부서를 찾는다. */
  Optional<Department> findById(long id);

  /** 저장된 부서 수를 돌려준다. */
  long count();
}
