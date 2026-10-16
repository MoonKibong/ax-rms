package com.ax.rms.assignment;

import static org.assertj.core.api.Assertions.assertThat;

import com.ax.rms.domain.Assignment;
import com.ax.rms.domain.AvailabilityStatus;
import com.ax.rms.domain.Employee;
import com.ax.rms.domain.Project;
import com.ax.rms.domain.ProjectStatus;
import com.ax.rms.repository.AssignmentRepository;
import com.ax.rms.repository.EmployeeRepository;
import com.ax.rms.repository.ProjectRepository;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;

/** T#53 기준 6: 후보 조회는 배치를 직원마다 읽지 않고 한 번에 읽는다. */
class AssignmentServiceCandidatesQueryTest {

  private static final LocalDate START = LocalDate.of(2026, 6, 15);
  private static final LocalDate END = LocalDate.of(2026, 6, 25);

  @Test
  void readsAssignmentsOnce() {
    CountingAssignments assignments = new CountingAssignments();
    List<Employee> employees = new ArrayList<>();
    for (long id = 1; id <= 20; id++) {
      employees.add(
          new Employee(id, "직원" + id, 1, "개발", 3, AvailabilityStatus.AVAILABLE, null, null));
    }
    assignments.rows.add(new Assignment(1L, 1, 1, START, END, 60));
    Project project = new Project(1L, "P", null, START, END, ProjectStatus.IN_PROGRESS);
    AssignmentService service =
        new AssignmentService(
            assignments, new FixedEmployees(employees), new FixedProjects(project));

    List<AssignmentService.Candidate> result = service.candidates(1, START, END);

    assertThat(result).hasSize(20);
    assertThat(result.get(0).periodAvailability()).isEqualTo(40);
    assertThat(result.get(1).periodAvailability()).isEqualTo(100);
    assertThat(assignments.byEmployeeCalls).as("findByEmployeeId calls").isZero();
    assertThat(assignments.findAllCalls).as("findAll calls").isEqualTo(1);
  }

  private static final class CountingAssignments implements AssignmentRepository {
    final List<Assignment> rows = new ArrayList<>();
    int byEmployeeCalls;
    int findAllCalls;

    @Override
    public Assignment insert(Assignment assignment) {
      rows.add(assignment);
      return assignment;
    }

    @Override
    public List<Assignment> findAll() {
      findAllCalls++;
      return List.copyOf(rows);
    }

    @Override
    public List<Assignment> findByEmployeeId(long employeeId) {
      byEmployeeCalls++;
      return rows.stream().filter(a -> a.employeeId() == employeeId).toList();
    }

    @Override
    public List<Assignment> findByProjectId(long projectId) {
      return rows.stream().filter(a -> a.projectId() == projectId).toList();
    }

    @Override
    public Optional<Assignment> findById(long id) {
      return rows.stream().filter(a -> a.id() != null && a.id() == id).findFirst();
    }

    @Override
    public void update(Assignment assignment) {}

    @Override
    public void delete(long id) {}

    @Override
    public long count() {
      return rows.size();
    }
  }

  private record FixedEmployees(List<Employee> all) implements EmployeeRepository {
    @Override
    public Employee insert(Employee employee) {
      return employee;
    }

    @Override
    public void update(Employee employee) {}

    @Override
    public List<Employee> findAll() {
      return all;
    }

    @Override
    public Optional<Employee> findById(long id) {
      return all.stream().filter(e -> e.id() == id).findFirst();
    }

    @Override
    public long count() {
      return all.size();
    }
  }

  private record FixedProjects(Project project) implements ProjectRepository {
    @Override
    public Project insert(Project p) {
      return p;
    }

    @Override
    public boolean update(Project p) {
      return false;
    }

    @Override
    public List<Project> findAll() {
      return List.of(project);
    }

    @Override
    public Optional<Project> findById(long id) {
      return Optional.of(project);
    }

    @Override
    public long count() {
      return 1;
    }
  }
}
