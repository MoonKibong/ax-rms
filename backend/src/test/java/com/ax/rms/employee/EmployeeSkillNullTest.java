package com.ax.rms.employee;

import static com.ax.rms.support.ErrorAssertions.assertError;

import com.ax.rms.repository.DepartmentRepository;
import com.ax.rms.support.AbstractApiTest;
import com.ax.rms.support.ApiClient;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/** T#56 기준 7: {@code skills}의 {@code null} 요소는 500이 아니라 400 {@code EMPLOYEE_SKILL_INVALID}다. */
class EmployeeSkillNullTest extends AbstractApiTest {

  @Autowired private DepartmentRepository departmentRepository;

  @Test
  void nullSkillElementIsRejectedAsInvalidSkill() {
    ApiClient hr = client();
    hr.login("hr.manager", "HrManager!1");
    long departmentId = departmentRepository.findAll().get(0).id();
    String body =
        "{\"name\":\"널기술\",\"departmentId\":" + departmentId
            + ",\"jobTitle\":\"백엔드 개발자\",\"careerYears\":1,\"skills\":[null]}";

    assertError(hr.sendJson("POST", "/api/employees", body), 400, "EMPLOYEE_SKILL_INVALID");
  }
}
