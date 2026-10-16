package com.ax.rms.web;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.ax.rms.support.AbstractDatabaseTest;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.ApplicationContext;
import org.springframework.web.bind.annotation.ControllerAdvice;

/** T#56 기준 2: 오류 처리기는 {@code com.ax.rms.web}에 하나이고 패키지별 예외 4종은 없다. */
class ErrorHandlingStructureTest extends AbstractDatabaseTest {

  @Autowired private ApplicationContext context;

  @Test
  void exactlyOneControllerAdviceLivesInTheWebPackage() {
    Map<String, Object> advices = context.getBeansWithAnnotation(ControllerAdvice.class);
    assertThat(advices.values().stream().map(a -> a.getClass().getName()))
        .hasSize(1)
        .allMatch(name -> name.startsWith("com.ax.rms.web."));
  }

  @Test
  void perPackageExceptionsAndHandlersAreGone() throws ClassNotFoundException {
    for (String name :
        new String[] {
          "com.ax.rms.employee.EmployeeApiException",
          "com.ax.rms.project.ProjectException",
          "com.ax.rms.assignment.AssignmentRuleException",
          "com.ax.rms.assignment.AssignmentNotFoundException",
          "com.ax.rms.employee.EmployeeApiExceptionHandler",
          "com.ax.rms.project.ProjectApiErrorHandler",
          "com.ax.rms.assignment.AssignmentApiErrorHandler"
        }) {
      assertThatThrownBy(() -> Class.forName(name))
          .as(name)
          .isInstanceOf(ClassNotFoundException.class);
    }
    assertThat(Class.forName("com.ax.rms.web.ApiException")).isNotNull();
  }
}
