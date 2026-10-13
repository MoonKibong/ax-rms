package com.ax.rms.repository;

import com.ax.rms.domain.ProjectRequiredSkillLine;
import java.util.List;

/** 프로젝트 필요 역량 줄 저장소. */
public interface ProjectRequiredSkillLineRepository {

  /** 필요 역량 줄을 저장하고, 생성된 id가 채워진 값을 돌려준다. */
  ProjectRequiredSkillLine insert(ProjectRequiredSkillLine line);

  /** 그 프로젝트의 필요 역량 줄을 전부 돌려준다. */
  List<ProjectRequiredSkillLine> findByProjectId(long projectId);

  /** 저장된 필요 역량 줄 수를 돌려준다. */
  long count();
}
