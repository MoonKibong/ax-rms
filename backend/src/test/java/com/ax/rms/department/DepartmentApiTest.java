package com.ax.rms.department;

import static org.assertj.core.api.Assertions.assertThat;

import com.ax.rms.domain.Department;
import com.ax.rms.repository.DepartmentRepository;
import com.ax.rms.support.AbstractApiTest;
import com.ax.rms.support.ApiClient;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/**
 * T#39 기준 1: 직원 등록·수정 폼이 고르는 부서 목록 {@code GET /api/departments}(D26). 관리자 세 계정은 시드의 세 부서를
 * {@code id} 오름차순으로 받는다. 직원만 가진 계정·비로그인·부서 쓰기는 #6의 권한 표대로 막힌다(회귀). 응답은
 * {@link Map}으로 읽어 키를 그대로 본다.
 */
class DepartmentApiTest extends AbstractApiTest {

  @Autowired private ObjectMapper objectMapper;
  @Autowired private DepartmentRepository departmentRepository;

  @Test
  void managersGetTheSeededDepartmentsInIdOrder() throws Exception {
    List<Map<String, Object>> expected =
        departmentRepository.findAll().stream()
            .map(
                department ->
                    Map.<String, Object>of("id", department.id(), "name", department.name()))
            .toList();
    assertThat(departmentRepository.findAll().stream().map(Department::name))
        .containsExactly("개발팀", "기획팀", "디자인팀");

    for (String[] account :
        new String[][] {
          {"hr.manager", "HrManager!1"},
          {"project.manager", "ProjectManager!1"},
          {"dual.manager", "DualManager!1"}
        }) {
      ApiClient.Response response = loggedIn(account[0], account[1]).get("/api/departments");
      assertThat(response.status()).as("%s GET /api/departments", account[0]).isEqualTo(200);
      List<Map<String, Object>> body =
          objectMapper.readValue(
              response.body(), new TypeReference<List<Map<String, Object>>>() {});
      assertThat(body).as("%s body", account[0]).hasSize(3);
      for (int i = 0; i < body.size(); i++) {
        assertThat(body.get(i).keySet()).containsExactlyInAnyOrder("id", "name");
        assertThat(((Number) body.get(i).get("id")).longValue())
            .isEqualTo(((Number) expected.get(i).get("id")).longValue());
        assertThat(body.get(i).get("name")).isEqualTo(expected.get(i).get("name"));
      }
    }
  }

  @Test
  void anEmployeeOnlyAccountIsForbidden() {
    ApiClient.Response response = loggedIn("employee.demo", "Employee!1").get("/api/departments");
    assertThat(response.status()).isEqualTo(403);
    assertThat(response.json().path("code").asText()).isEqualTo("AUTH_FORBIDDEN");
  }

  @Test
  void loggedOutVisitorsMustLogIn() {
    ApiClient.Response response = client().get("/api/departments");
    assertThat(response.status()).isEqualTo(401);
    assertThat(response.json().path("code").asText()).isEqualTo("AUTH_REQUIRED");
  }

  @Test
  void nobodyWritesDepartments() {
    ApiClient dual = loggedIn("dual.manager", "DualManager!1");
    String body = "{\"name\":\"새 부서\"}";
    for (String[] request :
        new String[][] {
          {"POST", "/api/departments"},
          {"PUT", "/api/departments/1"},
          {"DELETE", "/api/departments/1"}
        }) {
      ApiClient.Response response = dual.sendJson(request[0], request[1], body);
      assertThat(response.status()).as("%s %s", request[0], request[1]).isEqualTo(403);
      assertThat(response.json().path("code").asText()).isEqualTo("AUTH_FORBIDDEN");
    }
    assertThat(departmentRepository.count()).isEqualTo(3);
  }

  private ApiClient loggedIn(String username, String password) {
    ApiClient client = client();
    assertThat(client.login(username, password).status()).as("%s login", username).isEqualTo(200);
    return client;
  }
}
