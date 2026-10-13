package com.ax.rms.repository;

import com.ax.rms.domain.Project;
import java.util.List;
import java.util.Optional;

/** 프로젝트 저장소. */
public interface ProjectRepository {

  /** 프로젝트를 저장하고, 생성된 id가 채워진 값을 돌려준다. */
  Project insert(Project project);

  /** 전체 프로젝트를 돌려준다. */
  List<Project> findAll();

  /** 주어진 id로 프로젝트를 찾는다. */
  Optional<Project> findById(long id);

  /** 저장된 프로젝트 수를 돌려준다. */
  long count();
}
