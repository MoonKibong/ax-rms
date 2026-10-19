package com.ax.rms.config;

import com.zaxxer.hikari.HikariDataSource;
import org.springframework.beans.factory.config.BeanPostProcessor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Spring Boot가 만든 {@code dataSource} 빈(HikariDataSource)이 완전히 초기화된 뒤, 그 자리를
 * {@link BusyEvictingDataSource}로 바꿔 끼운다(T#54 기준 7). 이 클래스 자신이 {@code DataSource} 타입의
 * 빈을 새로 정의하면 Spring Boot의 {@code @ConditionalOnMissingBean(DataSource.class)}가 작동해
 * HikariDataSource 자체가 만들어지지 않으므로(직접 확인함), 만들어진 뒤 바꿔 끼우는 방식을 쓴다.
 */
@Configuration
public class DataSourceRecoveryConfig {

  /** {@code dataSource} 빈을 초기화 직후 {@link BusyEvictingDataSource}로 바꿔 끼우는 후처리기를 만든다. */
  @Bean
  public static BeanPostProcessor dataSourceRecoveryPostProcessor() {
    return new BeanPostProcessor() {
      @Override
      public Object postProcessAfterInitialization(Object bean, String beanName) {
        if (bean instanceof HikariDataSource hikariDataSource && "dataSource".equals(beanName)) {
          return new BusyEvictingDataSource(hikariDataSource);
        }
        return bean;
      }
    };
  }
}
