package com.ax.rms.repository;

import com.ax.rms.domain.EmployeeSkill;
import java.util.List;

/** 직원 기술 저장소. */
public interface EmployeeSkillRepository {

  /** 직원 기술 한 줄을 저장하고, 생성된 id가 채워진 값을 돌려준다. */
  EmployeeSkill insert(EmployeeSkill employeeSkill);

  /** 그 직원의 기술 줄을 전부 돌려준다. */
  List<EmployeeSkill> findByEmployeeId(long employeeId);

  /** 저장된 기술 줄 수를 돌려준다. */
  long count();
}
