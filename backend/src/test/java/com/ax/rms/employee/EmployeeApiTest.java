package com.ax.rms.employee;

import static org.assertj.core.api.Assertions.assertThat;

import com.ax.rms.domain.Assignment;
import com.ax.rms.domain.AvailabilityStatus;
import com.ax.rms.domain.ProficiencyLevel;
import com.ax.rms.domain.ProjectStatus;
import com.ax.rms.repository.AssignmentRepository;
import com.ax.rms.repository.DepartmentRepository;
import com.ax.rms.repository.EmployeeRepository;
import com.ax.rms.support.AbstractApiTest;
import com.ax.rms.support.ApiClient;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;
import org.springframework.beans.factory.annotation.Autowired;

/**
 * 직원 API를 실제 포트로 검사한다(D2, D6, D7, D15, D18, D19, D21, D33). 시드는 {@link
 * com.ax.rms.support.AbstractSeedTest}가 쓰는 고정 "오늘"(2026-06-15)과 T#5의 시드 데이터다. 권한은 #6의
 * 보안 설정이 적용되므로(이슈 #8 PM 결정), 모든 요청을 쓰기까지 할 수 있는 {@code hr.manager}로 로그인해
 * 보낸다 — 역할별 403은 이 테스트의 몫이 아니라 #6의 {@code AuthorizationPolicyTest}가 맡는다. 뒤쪽
 * 테스트(등록·수정·상태 변경)는 앞쪽 테스트(목록·상세 필터)가 세는 건수와 겹치지 않도록, 그리고 서로의 상태를
 * 건드리지 않도록 {@link Order}로 순서를 고정한다.
 */
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
class EmployeeApiTest extends AbstractApiTest {

  @Autowired private ObjectMapper objectMapper;
  @Autowired private EmployeeRepository employeeRepository;
  @Autowired private DepartmentRepository departmentRepository;
  @Autowired private AssignmentRepository assignmentRepository;

  private ApiClient client;

  @BeforeEach
  void loginAsHrManager() {
    client = client();
    client.login("hr.manager", "HrManager!1");
  }

  @Test
  @Order(1)
  void listReturnsAllEmployeesSortedByIdAndFiltersByName() throws Exception {
    List<EmployeeListItemResponse> all = list("");
    assertThat(all).hasSize(20);
    for (int i = 1; i < all.size(); i++) {
      assertThat(all.get(i).id()).isGreaterThan(all.get(i - 1).id());
    }

    List<EmployeeListItemResponse> byName = list("?name=소영");
    assertThat(byName).extracting(EmployeeListItemResponse::name).containsExactly("박소영");
  }

  @Test
  @Order(2)
  void listFiltersByDepartmentSkillAndStatus() throws Exception {
    long devId = departmentIdByName("개발팀");

    List<EmployeeListItemResponse> byDept = list("?departmentId=" + devId);
    assertThat(byDept).hasSize(8);
    assertThat(byDept).extracting(EmployeeListItemResponse::name)
        .contains("박소영", "최동훈", "한지우")
        .doesNotContain("이수민");

    List<EmployeeListItemResponse> bySkill = list("?skill=Java");
    assertThat(bySkill).extracting(EmployeeListItemResponse::name)
        .containsExactlyInAnyOrder("박소영", "한지우");

    List<EmployeeListItemResponse> byStatus = list("?status=UNAVAILABLE");
    assertThat(byStatus).extracting(EmployeeListItemResponse::name).containsExactly("최동훈");
  }

  @Test
  @Order(3)
  void listFiltersByMinAvailabilityAndCombinesFiltersWithAnd() throws Exception {
    List<EmployeeListItemResponse> atLeast60 = list("?minAvailability=60");
    assertThat(atLeast60).hasSize(15);
    assertThat(atLeast60).extracting(EmployeeListItemResponse::name)
        .contains("최동훈")
        .doesNotContain("박소영", "권지안");

    long devId = departmentIdByName("개발팀");
    List<EmployeeListItemResponse> combined =
        list("?departmentId=" + devId + "&status=UNAVAILABLE");
    assertThat(combined).extracting(EmployeeListItemResponse::name).containsExactly("최동훈");
  }

  @Test
  @Order(4)
  void detailShowsAssignmentsAndCurrentAvailability() throws Exception {
    long id = employeeIdByName("박소영");

    EmployeeDetailResponse body = detail(id);
    assertThat(body.departmentName()).isEqualTo("개발팀");
    assertThat(body.currentAvailability()).isEqualTo(40);
    assertThat(body.skills())
        .containsExactly(new EmployeeSkillResponse("Java", ProficiencyLevel.ADVANCED));
    assertThat(body.assignments()).hasSize(2);
    assertThat(body.assignments().get(0).projectName()).isEqualTo("감마 프로젝트");
    assertThat(body.assignments().get(0).projectStatus()).isEqualTo(ProjectStatus.DONE);
    assertThat(body.assignments().get(0).allocationPercent()).isEqualTo(30);
    assertThat(body.assignments().get(1).projectName()).isEqualTo("알파 프로젝트");
    assertThat(body.assignments().get(1).allocationPercent()).isEqualTo(60);
    assertThat(body.assignments().get(0).startDate())
        .isBefore(body.assignments().get(1).startDate());
  }

  @Test
  @Order(5)
  void detailShowsNeedsReviewForUnavailableEmployeeWithOpenAssignment() throws Exception {
    long id = employeeIdByName("최동훈");

    EmployeeDetailResponse body = detail(id);
    assertThat(body.availabilityStatus()).isEqualTo(AvailabilityStatus.UNAVAILABLE);
    assertThat(body.unavailableReason()).isEqualTo("육아휴직");
    assertThat(body.needsReview()).isTrue();
  }

  @Test
  @Order(6)
  void missingEmployeeReturns404ForDetailUpdateAndStatusChange() throws Exception {
    long missing = 999_999L;

    ApiClient.Response detailResponse = client.get("/api/employees/" + missing);
    assertNotFound(detailResponse);

    ApiClient.Response updateResponse =
        sendJson(
            "PUT",
            "/api/employees/" + missing,
            new EmployeeUpsertRequest("x", departmentIdByName("개발팀"), "y", 1, List.of()));
    assertNotFound(updateResponse);

    ApiClient.Response statusResponse =
        sendJson(
            "PATCH",
            "/api/employees/" + missing + "/status",
            new EmployeeStatusChangeRequest("AVAILABLE", null, null));
    assertNotFound(statusResponse);
  }

  @Test
  @Order(7)
  void registerCreatesEmployeeWithAvailableStatusAndAppearsInList() throws Exception {
    long devId = departmentIdByName("개발팀");
    EmployeeUpsertRequest request =
        new EmployeeUpsertRequest(
            "신규직원", devId, "백엔드 개발자", 1, List.of(new EmployeeSkillRequest("Go", "BEGINNER")));

    ApiClient.Response response = sendJson("POST", "/api/employees", request);
    assertThat(response.status()).isEqualTo(201);
    EmployeeDetailResponse body =
        objectMapper.readValue(response.body(), EmployeeDetailResponse.class);
    assertThat(body.availabilityStatus()).isEqualTo(AvailabilityStatus.AVAILABLE);
    assertThat(body.name()).isEqualTo("신규직원");

    List<EmployeeListItemResponse> all = list("");
    assertThat(all).hasSize(21);
    assertThat(all).extracting(EmployeeListItemResponse::name).contains("신규직원");
  }

  @Test
  @Order(8)
  void registerValidationErrors() throws Exception {
    long devId = departmentIdByName("개발팀");

    assertValidationError(
        new EmployeeUpsertRequest("", devId, "백엔드 개발자", 1, List.of()), "EMPLOYEE_NAME_REQUIRED");
    assertValidationError(
        new EmployeeUpsertRequest("새직원", devId, "", 1, List.of()), "EMPLOYEE_JOB_TITLE_REQUIRED");
    assertValidationError(
        new EmployeeUpsertRequest("새직원", 999_999L, "백엔드 개발자", 1, List.of()),
        "EMPLOYEE_DEPARTMENT_NOT_FOUND");
    assertValidationError(
        new EmployeeUpsertRequest("새직원", devId, "백엔드 개발자", -1, List.of()),
        "EMPLOYEE_CAREER_YEARS_INVALID");
    assertValidationError(
        new EmployeeUpsertRequest(
            "새직원",
            devId,
            "백엔드 개발자",
            1,
            List.of(
                new EmployeeSkillRequest("Java", "ADVANCED"),
                new EmployeeSkillRequest("Java", "BEGINNER"))),
        "EMPLOYEE_SKILL_DUPLICATE");
    assertValidationError(
        new EmployeeUpsertRequest(
            "새직원", devId, "백엔드 개발자", 1, List.of(new EmployeeSkillRequest("Java", "EXPERT"))),
        "EMPLOYEE_SKILL_INVALID");
  }

  @Test
  @Order(9)
  void updateAppliesChangesAndIgnoresStatusFields() throws Exception {
    long id = employeeIdByName("오승현");
    long designId = departmentIdByName("디자인팀");
    String rawBody =
        "{\"name\":\"오승현\",\"departmentId\":"
            + designId
            + ",\"jobTitle\":\"디자인팀장\",\"careerYears\":11,"
            + "\"skills\":[{\"skillName\":\"Figma\",\"proficiencyLevel\":\"ADVANCED\"},"
            + "{\"skillName\":\"Kubernetes\",\"proficiencyLevel\":\"BEGINNER\"}],"
            + "\"availabilityStatus\":\"UNAVAILABLE\"}";

    ApiClient.Response response = client.sendJson("PUT", "/api/employees/" + id, rawBody);
    assertThat(response.status()).isEqualTo(200);
    EmployeeDetailResponse body =
        objectMapper.readValue(response.body(), EmployeeDetailResponse.class);
    assertThat(body.careerYears()).isEqualTo(11);
    assertThat(body.skills()).extracting(EmployeeSkillResponse::skillName)
        .containsExactlyInAnyOrder("Figma", "Kubernetes");
    assertThat(body.availabilityStatus()).isEqualTo(AvailabilityStatus.AVAILABLE);

    EmployeeDetailResponse reread = detail(id);
    assertThat(reread.careerYears()).isEqualTo(11);
    assertThat(reread.availabilityStatus()).isEqualTo(AvailabilityStatus.AVAILABLE);
  }

  @Test
  @Order(10)
  void statusChangeSucceedsAndKeepsAssignments() throws Exception {
    long id = employeeIdByName("박소영");
    List<Assignment> before = assignmentRepository.findByEmployeeId(id);
    assertThat(before).hasSize(2);

    ApiClient.Response response =
        sendJson(
            "PATCH",
            "/api/employees/" + id + "/status",
            new EmployeeStatusChangeRequest("UNAVAILABLE", "병가", LocalDate.of(2026, 7, 1)));
    assertThat(response.status()).isEqualTo(200);
    EmployeeDetailResponse body =
        objectMapper.readValue(response.body(), EmployeeDetailResponse.class);
    assertThat(body.availabilityStatus()).isEqualTo(AvailabilityStatus.UNAVAILABLE);
    assertThat(body.unavailableReason()).isEqualTo("병가");
    assertThat(body.unavailableUntil()).isEqualTo(LocalDate.of(2026, 7, 1));

    List<Assignment> after = assignmentRepository.findByEmployeeId(id);
    assertThat(after).containsExactlyInAnyOrderElementsOf(before);
  }

  @Test
  @Order(11)
  void statusChangeValidationAndResetOnAvailable() throws Exception {
    long id = employeeIdByName("정하늘");

    ApiClient.Response missingReason =
        sendJson(
            "PATCH",
            "/api/employees/" + id + "/status",
            new EmployeeStatusChangeRequest("UNAVAILABLE", null, null));
    assertThat(missingReason.status()).isEqualTo(400);
    assertThat(readMap(missingReason)).containsEntry("code", "EMPLOYEE_REASON_REQUIRED");

    ApiClient.Response invalidStatus =
        sendJson(
            "PATCH",
            "/api/employees/" + id + "/status",
            new EmployeeStatusChangeRequest("RETIRED", null, null));
    assertThat(invalidStatus.status()).isEqualTo(400);
    assertThat(readMap(invalidStatus)).containsEntry("code", "EMPLOYEE_STATUS_INVALID");

    ApiClient.Response toUnavailable =
        sendJson(
            "PATCH",
            "/api/employees/" + id + "/status",
            new EmployeeStatusChangeRequest("UNAVAILABLE", "교육 파견", LocalDate.of(2026, 9, 1)));
    assertThat(toUnavailable.status()).isEqualTo(200);

    ApiClient.Response backToAvailable =
        sendJson(
            "PATCH",
            "/api/employees/" + id + "/status",
            new EmployeeStatusChangeRequest("AVAILABLE", null, null));
    assertThat(backToAvailable.status()).isEqualTo(200);
    EmployeeDetailResponse body =
        objectMapper.readValue(backToAvailable.body(), EmployeeDetailResponse.class);
    assertThat(body.availabilityStatus()).isEqualTo(AvailabilityStatus.AVAILABLE);
    assertThat(body.unavailableReason()).isNull();
    assertThat(body.unavailableUntil()).isNull();
  }

  private void assertNotFound(ApiClient.Response response) throws Exception {
    assertThat(response.status()).isEqualTo(404);
    Map<String, Object> body = readMap(response);
    assertThat(body).containsEntry("code", "EMPLOYEE_NOT_FOUND");
    assertThat(body.keySet()).containsExactlyInAnyOrder("code", "message");
  }

  private void assertValidationError(EmployeeUpsertRequest request, String expectedCode)
      throws Exception {
    ApiClient.Response response = sendJson("POST", "/api/employees", request);
    assertThat(response.status()).isEqualTo(400);
    Map<String, Object> body = readMap(response);
    assertThat(body).containsEntry("code", expectedCode);
    assertThat(body.keySet()).containsExactlyInAnyOrder("code", "message");
  }

  private long employeeIdByName(String name) {
    return employeeRepository.findAll().stream()
        .filter(e -> e.name().equals(name))
        .findFirst()
        .orElseThrow()
        .id();
  }

  private long departmentIdByName(String name) {
    return departmentRepository.findAll().stream()
        .filter(d -> d.name().equals(name))
        .findFirst()
        .orElseThrow()
        .id();
  }

  private List<EmployeeListItemResponse> list(String query) throws Exception {
    ApiClient.Response response = client.get("/api/employees" + query);
    assertThat(response.status()).isEqualTo(200);
    return objectMapper.readValue(
        response.body(), new TypeReference<List<EmployeeListItemResponse>>() {});
  }

  private EmployeeDetailResponse detail(long id) throws Exception {
    ApiClient.Response response = client.get("/api/employees/" + id);
    assertThat(response.status()).isEqualTo(200);
    return objectMapper.readValue(response.body(), EmployeeDetailResponse.class);
  }

  private Map<String, Object> readMap(ApiClient.Response response) throws Exception {
    return objectMapper.readValue(response.body(), new TypeReference<Map<String, Object>>() {});
  }

  private ApiClient.Response sendJson(String method, String path, Object body) throws Exception {
    return client.sendJson(method, path, objectMapper.writeValueAsString(body));
  }
}
