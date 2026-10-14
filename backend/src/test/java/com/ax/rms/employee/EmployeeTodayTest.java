package com.ax.rms.employee;

import static org.assertj.core.api.Assertions.assertThat;

import com.ax.rms.domain.Employee;
import com.ax.rms.repository.EmployeeRepository;
import com.ax.rms.support.AbstractApiTest;
import com.ax.rms.support.AbstractSeedTest;
import com.ax.rms.support.ApiClient;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;
import org.springframework.beans.factory.annotation.Autowired;

/**
 * T#38 기준 1: 직원 상세 응답의 {@code today}(D19). 서버가 가용률과 확인 필요를 계산한 날짜이고, 화면의 간트가 그 날짜로
 * 오늘 선을 그린다. 고정 {@code Clock}이라 값은 {@link AbstractSeedTest#FIXED_TODAY}다. 응답은 {@link Map}으로 읽어
 * 키가 있고 없음을 그대로 본다. 쓰기 검사는 마지막 순서이고 이 클래스의 임시 DB에만 남는다.
 */
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
class EmployeeTodayTest extends AbstractApiTest {

  private static final String TODAY = AbstractSeedTest.FIXED_TODAY.toString();

  @Autowired private ObjectMapper objectMapper;
  @Autowired private EmployeeRepository employeeRepository;

  @Test
  @Order(1)
  void theDetailCarriesTheServerToday() throws Exception {
    ApiClient hr = loggedIn("hr.manager", "HrManager!1");
    ApiClient.Response detail = hr.get("/api/employees/" + idOf("박소영"));
    assertThat(detail.status()).isEqualTo(200);
    Map<String, Object> body = readMap(detail.body());

    assertThat(body).containsEntry("today", TODAY);
    assertThat(body.keySet())
        .containsExactlyInAnyOrder(
            "id",
            "name",
            "departmentId",
            "departmentName",
            "jobTitle",
            "careerYears",
            "availabilityStatus",
            "unavailableReason",
            "unavailableUntil",
            "currentAvailability",
            "needsReview",
            "skills",
            "assignments",
            "today");
  }

  @Test
  @Order(2)
  void myDetailCarriesTheSameToday() throws Exception {
    ApiClient.Response me = loggedIn("employee.demo", "Employee!1").get("/api/me/employee");
    assertThat(me.status()).isEqualTo(200);
    Map<String, Object> body = readMap(me.body());

    assertThat(body).containsEntry("today", TODAY);
    assertThat(body).containsEntry("name", "한지우");
  }

  @Test
  @Order(3)
  void listItemsDoNotCarryToday() throws Exception {
    ApiClient.Response list = loggedIn("hr.manager", "HrManager!1").get("/api/employees");
    assertThat(list.status()).isEqualTo(200);
    List<Map<String, Object>> items =
        objectMapper.readValue(list.body(), new TypeReference<List<Map<String, Object>>>() {});

    assertThat(items).hasSize(20);
    for (Map<String, Object> item : items) {
      assertThat(item).as("%s", item.get("name")).doesNotContainKey("today");
    }
  }

  @Test
  @Order(4)
  void registerUpdateAndStatusChangeAnswerWithToday() throws Exception {
    ApiClient hr = loggedIn("hr.manager", "HrManager!1");
    long departmentId = employeeRepository.findById(idOf("박소영")).orElseThrow().departmentId();
    String upsert =
        objectMapper.writeValueAsString(
            Map.of(
                "name", "오늘 확인",
                "departmentId", departmentId,
                "jobTitle", "QA",
                "careerYears", 1,
                "skills", List.of()));

    ApiClient.Response created = hr.sendJson("POST", "/api/employees", upsert);
    assertThat(created.status()).isEqualTo(201);
    Map<String, Object> createdBody = readMap(created.body());
    assertThat(createdBody).containsEntry("today", TODAY);
    long id = ((Number) createdBody.get("id")).longValue();

    ApiClient.Response updated = hr.sendJson("PUT", "/api/employees/" + id, upsert);
    assertThat(updated.status()).isEqualTo(200);
    assertThat(readMap(updated.body())).containsEntry("today", TODAY);

    String status =
        objectMapper.writeValueAsString(
            Map.of("availabilityStatus", "UNAVAILABLE", "unavailableReason", "교육"));
    ApiClient.Response changed = hr.sendJson("PATCH", "/api/employees/" + id + "/status", status);
    assertThat(changed.status()).isEqualTo(200);
    assertThat(readMap(changed.body())).containsEntry("today", TODAY);
  }

  private ApiClient loggedIn(String username, String password) {
    ApiClient client = client();
    assertThat(client.login(username, password).status()).as("%s login", username).isEqualTo(200);
    return client;
  }

  private long idOf(String name) {
    return employeeRepository.findAll().stream()
        .filter(employee -> employee.name().equals(name))
        .map(Employee::id)
        .findFirst()
        .orElseThrow();
  }

  private Map<String, Object> readMap(String json) throws Exception {
    return objectMapper.readValue(json, new TypeReference<Map<String, Object>>() {});
  }
}
