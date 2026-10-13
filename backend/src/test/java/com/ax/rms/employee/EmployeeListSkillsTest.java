package com.ax.rms.employee;

import static org.assertj.core.api.Assertions.assertThat;

import com.ax.rms.repository.EmployeeRepository;
import com.ax.rms.support.AbstractApiTest;
import com.ax.rms.support.ApiClient;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;
import org.springframework.beans.factory.annotation.Autowired;

/**
 * T#13 기준 1: 직원 목록 항목의 {@code skills}(T#13 계약서 "목록 API의 {@code skills}"). 응답은 {@link Map}으로 읽어
 * 키가 있고 없음을 그대로 본다. 시드는 T#5의 데이터다. 수정 검사는 시드 값 검사 뒤에 돌도록 {@link Order}로 순서를
 * 고정한다.
 */
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
class EmployeeListSkillsTest extends AbstractApiTest {

  @Autowired private ObjectMapper objectMapper;
  @Autowired private EmployeeRepository employeeRepository;

  private ApiClient client;

  @BeforeEach
  void loginAsHrManager() {
    client = client();
    client.login("hr.manager", "HrManager!1");
  }

  @Test
  @Order(1)
  void everyListItemCarriesItsSkillsAsAnArrayOfTwoKeyLines() throws Exception {
    List<Map<String, Object>> all = list("");
    assertThat(all).hasSize(20);

    assertThat(skillsOf(all, "박소영"))
        .containsExactly(Map.of("skillName", "Java", "proficiencyLevel", "ADVANCED"));
    assertThat(skillsOf(all, "최동훈"))
        .containsExactly(Map.of("skillName", "React", "proficiencyLevel", "INTERMEDIATE"));
    assertThat(skillsOf(all, "한지우"))
        .containsExactly(Map.of("skillName", "Java", "proficiencyLevel", "BEGINNER"));
    assertThat(skillsOf(all, "이수민")).isEmpty();

    for (Map<String, Object> item : all) {
      assertThat(item).as("%s has the skills key", item.get("name")).containsKey("skills");
      assertThat(item.get("skills")).as("%s skills", item.get("name")).isInstanceOf(List.class);
      for (Map<String, Object> line : skills(item)) {
        assertThat(line.keySet()).containsExactlyInAnyOrder("skillName", "proficiencyLevel");
      }
    }
  }

  @Test
  @Order(2)
  void listSkillsEqualDetailSkillsForEverySeededEmployee() throws Exception {
    for (Map<String, Object> item : list("")) {
      long id = ((Number) item.get("id")).longValue();
      ApiClient.Response detail = client.get("/api/employees/" + id);
      assertThat(detail.status()).isEqualTo(200);
      Map<String, Object> body = readMap(detail.body());
      assertThat(item.get("skills")).as("%s skills", item.get("name")).isEqualTo(body.get("skills"));
    }
  }

  @Test
  @Order(3)
  void listSkillsFollowTheSavedOrderAndKeepEveryLineUnderTheSkillFilter() throws Exception {
    long id = employeeIdByName("박소영");
    Map<String, Object> current = readMap(client.get("/api/employees/" + id).body());
    String update =
        objectMapper.writeValueAsString(
            Map.of(
                "name", current.get("name"),
                "departmentId", current.get("departmentId"),
                "jobTitle", current.get("jobTitle"),
                "careerYears", current.get("careerYears"),
                "skills",
                    List.of(
                        Map.of("skillName", "Kubernetes", "proficiencyLevel", "BEGINNER"),
                        Map.of("skillName", "Java", "proficiencyLevel", "ADVANCED"))));
    assertThat(client.sendJson("PUT", "/api/employees/" + id, update).status()).isEqualTo(200);

    List<Map<String, Object>> expected =
        List.of(
            Map.of("skillName", "Kubernetes", "proficiencyLevel", "BEGINNER"),
            Map.of("skillName", "Java", "proficiencyLevel", "ADVANCED"));
    assertThat(skillsOf(list(""), "박소영")).containsExactlyElementsOf(expected);

    List<Map<String, Object>> filtered = list("?skill=Kubernetes");
    assertThat(filtered).extracting(item -> item.get("name")).containsExactly("박소영");
    assertThat(skills(filtered.get(0))).containsExactlyElementsOf(expected);
  }

  private List<Map<String, Object>> skillsOf(List<Map<String, Object>> items, String name) {
    Map<String, Object> item =
        items.stream().filter(i -> name.equals(i.get("name"))).findFirst().orElseThrow();
    assertThat(item).as("%s has the skills key", name).containsKey("skills");
    return skills(item);
  }

  @SuppressWarnings("unchecked")
  private static List<Map<String, Object>> skills(Map<String, Object> item) {
    return (List<Map<String, Object>>) item.get("skills");
  }

  private long employeeIdByName(String name) {
    return employeeRepository.findAll().stream()
        .filter(e -> e.name().equals(name))
        .findFirst()
        .orElseThrow()
        .id();
  }

  private List<Map<String, Object>> list(String query) throws Exception {
    ApiClient.Response response = client.get("/api/employees" + query);
    assertThat(response.status()).isEqualTo(200);
    return objectMapper.readValue(
        response.body(), new TypeReference<List<Map<String, Object>>>() {});
  }

  private Map<String, Object> readMap(String body) throws Exception {
    return objectMapper.readValue(body, new TypeReference<Map<String, Object>>() {});
  }
}
