package com.ax.rms.project;

import static com.ax.rms.project.ProjectApiAssertions.assertApiError;
import static com.ax.rms.project.ProjectApiAssertions.loginAsProjectManager;
import static org.assertj.core.api.Assertions.assertThat;

import com.ax.rms.domain.Assignment;
import com.ax.rms.domain.Employee;
import com.ax.rms.repository.AssignmentRepository;
import com.ax.rms.repository.EmployeeRepository;
import com.ax.rms.repository.ProjectRepository;
import com.ax.rms.support.AbstractApiTest;
import com.ax.rms.support.ApiClient;
import com.ax.rms.support.ApiClient.Response;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Consumer;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/**
 * T#9 기준 5–8, 10: 프로젝트 등록·수정 API. 같은 클래스의 테스트는 DB를 같이 쓰므로, 시드 프로젝트는 바꾸지 않고 테스트가 만든
 * 프로젝트와 저장소로 넣은 배정만 바꾼다.
 */
class ProjectWriteApiTest extends AbstractApiTest {

  private static final ObjectMapper JSON = new ObjectMapper();

  @Autowired private ProjectRepository projectRepository;
  @Autowired private AssignmentRepository assignmentRepository;
  @Autowired private EmployeeRepository employeeRepository;

  private ApiClient manager() {
    return loginAsProjectManager(client());
  }

  private static Map<String, Object> skill(
      String jobTitle, String skillName, String level, Object headcount) {
    Map<String, Object> line = new LinkedHashMap<>();
    line.put("jobTitle", jobTitle);
    line.put("skillName", skillName);
    line.put("proficiencyLevel", level);
    if (headcount != null) {
      line.put("headcount", headcount);
    }
    return line;
  }

  private static Map<String, Object> validBody() {
    Map<String, Object> body = new LinkedHashMap<>();
    body.put("name", "새 프로젝트");
    body.put("description", "설명");
    body.put("startDate", "2026-07-01");
    body.put("endDate", "2026-12-31");
    body.put("status", "PLANNED");
    body.put(
        "requiredSkills",
        List.of(
            skill("백엔드 개발자", "Java", "ADVANCED", 2), skill("디자이너", "Figma", "BEGINNER", 3)));
    return body;
  }

  private static String json(Map<String, Object> body) {
    try {
      return JSON.writeValueAsString(body);
    } catch (com.fasterxml.jackson.core.JsonProcessingException e) {
      throw new IllegalStateException(e);
    }
  }

  private Response post(ApiClient client, Map<String, Object> body) {
    return client.sendJson("POST", "/api/projects", json(body));
  }

  private Response put(ApiClient client, long id, Map<String, Object> body) {
    return client.sendJson("PUT", "/api/projects/" + id, json(body));
  }

  private long create(ApiClient client, Map<String, Object> body) {
    Response response = post(client, body);
    assertThat(response.status()).as("등록 상태 (본문: %s)", response.body()).isEqualTo(201);
    return response.json().get("id").asLong();
  }

  @Test
  void create() {
    ApiClient client = manager();
    long before = projectRepository.count();

    Response response = post(client, validBody());

    assertThat(response.status()).as("등록 상태 (본문: %s)", response.body()).isEqualTo(201);
    JsonNode body = response.json();
    long id = body.get("id").asLong();
    assertThat(response.headers("Location")).containsExactly("/api/projects/" + id);
    assertThat(body.get("requiredHeadcount").asInt()).isEqualTo(5);
    assertThat(body.get("assignedHeadcount").asInt()).isEqualTo(0);
    assertThat(body.get("assignments")).isEmpty();
    assertThat(projectRepository.count()).isEqualTo(before + 1);

    JsonNode detail = client.get("/api/projects/" + id).json();
    assertThat(detail.get("name").asText()).isEqualTo("새 프로젝트");
    assertThat(detail.get("status").asText()).isEqualTo("PLANNED");
    assertThat(detail.get("requiredSkills")).hasSize(2);
    assertThat(detail.get("requiredSkills").get(0).get("skillName").asText()).isEqualTo("Java");
    assertThat(detail.get("requiredSkills").get(1).get("headcount").asInt()).isEqualTo(3);

    Map<String, Object> bare = validBody();
    bare.remove("description");
    bare.remove("requiredSkills");
    Response bareResponse = post(client, bare);
    assertThat(bareResponse.status()).as("줄·설명 없는 등록 (본문: %s)", bareResponse.body()).isEqualTo(201);
    assertThat(bareResponse.json().get("requiredHeadcount").asInt()).isEqualTo(0);
    assertThat(bareResponse.json().get("requiredSkills")).isEmpty();
    assertThat(bareResponse.json().get("description").isNull()).isTrue();
  }

  private record Case(String label, Consumer<Map<String, Object>> change, String code) {}

  private static Consumer<Map<String, Object>> firstSkill(Consumer<Map<String, Object>> change) {
    return body -> {
      @SuppressWarnings("unchecked")
      List<Map<String, Object>> lines = (List<Map<String, Object>>) body.get("requiredSkills");
      List<Map<String, Object>> copy = new ArrayList<>(lines);
      Map<String, Object> first = new LinkedHashMap<>(copy.get(0));
      change.accept(first);
      copy.set(0, first);
      body.put("requiredSkills", copy);
    };
  }

  @Test
  void createValidation() {
    ApiClient client = manager();
    long before = projectRepository.count();
    List<Case> cases =
        List.of(
            new Case("이름 공백", b -> b.put("name", "   "), "PROJECT_NAME_REQUIRED"),
            new Case("이름 없음", b -> b.remove("name"), "PROJECT_NAME_REQUIRED"),
            new Case("시작일 없음", b -> b.remove("startDate"), "PROJECT_PERIOD_REQUIRED"),
            new Case("종료일 날짜 아님", b -> b.put("endDate", "2026-13-01"), "PROJECT_PERIOD_REQUIRED"),
            new Case(
                "종료일이 하루 앞섬",
                b -> {
                  b.put("startDate", "2026-07-02");
                  b.put("endDate", "2026-07-01");
                },
                "PROJECT_PERIOD_INVALID"),
            new Case("상태 알 수 없음", b -> b.put("status", "ACTIVE"), "PROJECT_STATUS_INVALID"),
            new Case("상태 없음", b -> b.remove("status"), "PROJECT_STATUS_INVALID"),
            new Case(
                "직무 공백", firstSkill(l -> l.put("jobTitle", " ")), "PROJECT_SKILL_LINE_INVALID"),
            new Case(
                "기술 없음", firstSkill(l -> l.remove("skillName")), "PROJECT_SKILL_LINE_INVALID"),
            new Case(
                "숙련도 알 수 없음",
                firstSkill(l -> l.put("proficiencyLevel", "EXPERT")),
                "PROJECT_SKILL_LINE_INVALID"),
            new Case(
                "인원 0", firstSkill(l -> l.put("headcount", 0)), "PROJECT_SKILL_LINE_INVALID"),
            new Case(
                "인원 없음", firstSkill(l -> l.remove("headcount")), "PROJECT_SKILL_LINE_INVALID"),
            new Case(
                "이름 공백과 상태 오류가 함께",
                b -> {
                  b.put("name", "");
                  b.put("status", "ACTIVE");
                },
                "PROJECT_NAME_REQUIRED"));

    for (Case testCase : cases) {
      Map<String, Object> body = validBody();
      testCase.change().accept(body);
      Response response = post(client, body);
      assertThat(response.status())
          .as("%s: 상태 (본문: %s)", testCase.label(), response.body())
          .isEqualTo(400);
      assertApiError(response, 400, testCase.code());
    }
    assertApiError(
        client.sendJson("POST", "/api/projects", "not json"), 400, "PROJECT_REQUEST_INVALID");
    assertThat(projectRepository.count()).as("거절된 요청은 프로젝트를 만들지 않는다").isEqualTo(before);

    Map<String, Object> sameDay = validBody();
    sameDay.put("startDate", "2026-07-01");
    sameDay.put("endDate", "2026-07-01");
    assertThat(post(client, sameDay).status()).as("시작일=종료일").isEqualTo(201);
  }

  @Test
  void update() {
    ApiClient client = manager();
    long id = create(client, validBody());

    Map<String, Object> changed = validBody();
    changed.put("name", "바뀐 프로젝트");
    changed.put("description", "바뀐 설명");
    changed.put("status", "IN_PROGRESS");
    changed.put("startDate", "2026-06-01");
    changed.put("endDate", "2027-01-31");
    changed.put("requiredSkills", List.of(skill("기획자", "기획", "INTERMEDIATE", 4)));
    Response response = put(client, id, changed);

    assertThat(response.status()).as("수정 상태 (본문: %s)", response.body()).isEqualTo(200);
    for (JsonNode body : List.of(response.json(), client.get("/api/projects/" + id).json())) {
      assertThat(body.get("name").asText()).isEqualTo("바뀐 프로젝트");
      assertThat(body.get("description").asText()).isEqualTo("바뀐 설명");
      assertThat(body.get("status").asText()).isEqualTo("IN_PROGRESS");
      assertThat(body.get("startDate").asText()).isEqualTo("2026-06-01");
      assertThat(body.get("endDate").asText()).isEqualTo("2027-01-31");
      assertThat(body.get("requiredSkills")).hasSize(1);
      assertThat(body.get("requiredSkills").get(0).get("skillName").asText()).isEqualTo("기획");
      assertThat(body.get("requiredHeadcount").asInt()).isEqualTo(4);
    }

    changed.remove("requiredSkills");
    JsonNode noLines = put(client, id, changed).json();
    assertThat(noLines.get("requiredSkills")).isEmpty();
    assertThat(noLines.get("requiredHeadcount").asInt()).isEqualTo(0);

    assertApiError(put(client, 99999, validBody()), 404, "PROJECT_NOT_FOUND");

    Map<String, Object> invalid = validBody();
    invalid.put("name", " ");
    assertApiError(put(client, id, invalid), 400, "PROJECT_NAME_REQUIRED");
    assertThat(client.get("/api/projects/" + id).json().get("name").asText())
        .as("거절된 수정은 바꾸지 않는다")
        .isEqualTo("바뀐 프로젝트");
  }

  private long projectWithAssignments(ApiClient client, Map<String, Object> bodyFields) {
    Map<String, Object> body = validBody();
    body.putAll(bodyFields);
    return create(client, body);
  }

  private Employee employee(String name) {
    return employeeRepository.findAll().stream()
        .filter(e -> e.name().equals(name))
        .findFirst()
        .orElseThrow();
  }

  private void insertAssignment(Employee employee, long projectId, LocalDate start, LocalDate end) {
    assignmentRepository.insert(new Assignment(null, employee.id(), projectId, start, end, 10));
  }

  /** 기간만이 아니라 이름·상태·필요 역량 줄도 바꾸려는 요청 본문. 막히면 이것들도 바뀌지 않아야 한다. */
  private Map<String, Object> blockedBody(String startDate, String endDate) {
    Map<String, Object> body = validBody();
    body.put("name", "바꾸려던 이름");
    body.put("status", "ON_HOLD");
    body.put("requiredSkills", List.of(skill("기획자", "기획", "BEGINNER", 1)));
    body.put("startDate", startDate);
    body.put("endDate", endDate);
    return body;
  }

  private void assertBlocked(
      ApiClient client, long id, Map<String, Object> body, String count, Names names) {
    Response response = put(client, id, body);
    assertApiError(response, 400, "PROJECT_PERIOD_EXCLUDES_ASSIGNMENTS");
    String message = response.json().get("message").asText();
    assertThat(message).contains(count);
    for (String name : names.present()) {
      assertThat(message).contains(name);
    }
    for (String name : names.absent()) {
      assertThat(message).doesNotContain(name);
    }
  }

  private void assertEveryShrinkIsBlocked(ApiClient client, long id) {
    assertBlocked(client, id, blockedBody("2026-05-01", "2026-09-07"), "1건", ONLY_FIRST);
    assertBlocked(client, id, blockedBody("2026-05-21", "2026-12-31"), "1건", ONLY_FIRST);
    assertBlocked(client, id, blockedBody("2026-06-02", "2026-12-31"), "2건", BOTH);
  }

  private record Names(List<String> present, List<String> absent) {}

  private static final Names ONLY_FIRST = new Names(List.of("박소영"), List.of("강민재"));
  private static final Names BOTH = new Names(List.of("박소영", "강민재"), List.of());

  @Test
  void periodExcludesAssignments() {
    ApiClient client = manager();
    Map<String, Object> period = new LinkedHashMap<>();
    period.put("startDate", "2026-05-01");
    period.put("endDate", "2026-12-31");
    long id = projectWithAssignments(client, period);
    insertAssignment(employee("박소영"), id, LocalDate.of(2026, 5, 20), LocalDate.of(2026, 9, 8));
    insertAssignment(employee("강민재"), id, LocalDate.of(2026, 6, 1), LocalDate.of(2026, 8, 31));
    JsonNode before = client.get("/api/projects/" + id).json();

    assertEveryShrinkIsBlocked(client, id);

    assertThat(client.get("/api/projects/" + id).json())
        .as("막힌 요청은 이름·상태·줄까지 아무것도 바꾸지 않는다")
        .isEqualTo(before);

    Map<String, Object> exact = validBody();
    exact.put("startDate", "2026-05-20");
    exact.put("endDate", "2026-09-08");
    assertThat(put(client, id, exact).status()).as("배정이 이루는 구간과 같은 기간").isEqualTo(200);

    Map<String, Object> wider = validBody();
    wider.put("startDate", "2026-01-01");
    wider.put("endDate", "2027-12-31");
    assertThat(put(client, id, wider).status()).as("기간을 넓힘").isEqualTo(200);

    long free = create(client, validBody());
    Map<String, Object> shrunk = validBody();
    shrunk.put("startDate", "2026-09-01");
    shrunk.put("endDate", "2026-09-02");
    assertThat(put(client, free, shrunk).status()).as("배정 없는 프로젝트의 기간 줄이기").isEqualTo(200);
  }

  @Test
  void unsupportedMediaType() {
    Response response = manager().send("POST", "/api/projects", "text/plain", "프로젝트");

    assertApiError(response, 415, "UNSUPPORTED_MEDIA_TYPE");
  }
}
