package com.ax.rms.seed;

import static org.assertj.core.api.Assertions.assertThat;

import com.ax.rms.repository.DepartmentRepository;
import com.ax.rms.support.AbstractSeedTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.DefaultApplicationArguments;

class SeedTriggerTest extends AbstractSeedTest {

  @Autowired private DepartmentRepository departmentRepository;
  @Autowired private SeedRunner seedRunner;

  @Test
  void seedsOnceAndDoesNotReseedWhenRunAgain() {
    long afterFirstRun = departmentRepository.count();
    assertThat(afterFirstRun).isGreaterThan(0);

    seedRunner.run(new DefaultApplicationArguments());

    assertThat(departmentRepository.count()).isEqualTo(afterFirstRun);
  }
}
