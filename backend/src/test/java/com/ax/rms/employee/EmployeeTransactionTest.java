package com.ax.rms.employee;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.ax.rms.domain.Employee;
import com.ax.rms.domain.EmployeeSkill;
import com.ax.rms.repository.DepartmentRepository;
import com.ax.rms.repository.EmployeeRepository;
import com.ax.rms.repository.EmployeeSkillRepository;
import com.ax.rms.repository.jdbc.JdbcEmployeeSkillRepository;
import com.ax.rms.support.AbstractSeedTest;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;

/**
 * 직원 등록·수정이 기술 삽입 중 실패하면 전부 롤백되는지 본다(T#54 기준 4, B#3). 두 번째 기술을 넣을 때 던지는
 * {@link SpyingEmployeeSkillRepository}로 {@code EmployeeSkillRepository.insert}가 두 번째 호출될 때만
 * 실패를 흉내 낸다.
 */
@Import(EmployeeTransactionTest.FailingSkillConfig.class)
class EmployeeTransactionTest extends AbstractSeedTest {

  @Autowired private EmployeeService employeeService;
  @Autowired private EmployeeRepository employeeRepository;
  @Autowired private DepartmentRepository departmentRepository;
  @Autowired private SpyingEmployeeSkillRepository spyingSkillRepository;

  @BeforeEach
  void resetSpy() {
    spyingSkillRepository.stopFailing();
  }

  @Test
  void registerRollsBackTheEmployeeWhenOneSkillInsertFails() {
    long devId = departmentRepository.findAll().get(0).id();
    EmployeeUpsertRequest request =
        new EmployeeUpsertRequest(
            "T54새직원",
            devId,
            "개발자",
            1,
            List.of(
                new EmployeeSkillRequest("Java", "ADVANCED"),
                new EmployeeSkillRequest("Go", "BEGINNER")));
    spyingSkillRepository.failOnNextInsert();

    assertThrows(RuntimeException.class, () -> employeeService.register(request));

    assertThat(employeeRepository.findAll())
        .extracting(Employee::name)
        .doesNotContain("T54새직원");
  }

  @Test
  void updateKeepsOriginalSkillsWhenReinsertFails() {
    long devId = departmentRepository.findAll().get(0).id();
    EmployeeUpsertRequest createRequest =
        new EmployeeUpsertRequest(
            "T54수정대상",
            devId,
            "개발자",
            1,
            List.of(new EmployeeSkillRequest("Java", "ADVANCED")));
    long id = employeeService.register(createRequest).id();
    List<EmployeeSkill> originalSkills = spyingSkillRepository.findByEmployeeId(id);
    assertThat(originalSkills).hasSize(1);

    EmployeeUpsertRequest updateRequest =
        new EmployeeUpsertRequest(
            "T54수정대상",
            devId,
            "개발자",
            1,
            List.of(
                new EmployeeSkillRequest("Python", "BEGINNER"),
                new EmployeeSkillRequest("Rust", "BEGINNER")));
    spyingSkillRepository.failOnNextInsert();

    assertThrows(RuntimeException.class, () -> employeeService.update(id, updateRequest));

    assertThat(spyingSkillRepository.findByEmployeeId(id))
        .containsExactlyInAnyOrderElementsOf(originalSkills);
  }

  /** {@code EmployeeSkillRepository.insert}를 가로채 다음 한 번의 호출에서만 실패를 흉내 낸다. */
  static final class SpyingEmployeeSkillRepository implements EmployeeSkillRepository {

    private final EmployeeSkillRepository delegate;
    private boolean failOnNextInsert;

    SpyingEmployeeSkillRepository(EmployeeSkillRepository delegate) {
      this.delegate = delegate;
    }

    void failOnNextInsert() {
      this.failOnNextInsert = true;
    }

    void stopFailing() {
      this.failOnNextInsert = false;
    }

    @Override
    public EmployeeSkill insert(EmployeeSkill employeeSkill) {
      if (failOnNextInsert) {
        failOnNextInsert = false;
        throw new RuntimeException("T#54 강제 실패: 직원 기술 삽입 재현");
      }
      return delegate.insert(employeeSkill);
    }

    @Override
    public List<EmployeeSkill> findByEmployeeId(long employeeId) {
      return delegate.findByEmployeeId(employeeId);
    }

    @Override
    public List<EmployeeSkill> findAll() {
      return delegate.findAll();
    }

    @Override
    public void deleteByEmployeeId(long employeeId) {
      delegate.deleteByEmployeeId(employeeId);
    }

    @Override
    public long count() {
      return delegate.count();
    }
  }

  @TestConfiguration
  static class FailingSkillConfig {

    @Bean
    @Primary
    SpyingEmployeeSkillRepository spyingEmployeeSkillRepository(JdbcEmployeeSkillRepository real) {
      return new SpyingEmployeeSkillRepository(real);
    }
  }
}
