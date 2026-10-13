package com.ax.rms.repository;

import com.ax.rms.domain.Employee;
import java.util.List;
import java.util.Optional;

/** 직원 저장소. */
public interface EmployeeRepository {

  /** 직원을 저장하고, 생성된 id가 채워진 값을 돌려준다. */
  Employee insert(Employee employee);

  /** 전체 직원을 돌려준다. */
  List<Employee> findAll();

  /** 주어진 id로 직원을 찾는다. */
  Optional<Employee> findById(long id);

  /** 저장된 직원 수를 돌려준다. */
  long count();
}
