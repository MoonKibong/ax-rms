package com.ax.rms.web;

import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/** Reports whether the backend is up. */
@RestController
public class HealthController {

  /**
   * Returns the backend's status.
   *
   * @return a map with a single {@code status} entry
   */
  @GetMapping("/api/health")
  public Map<String, String> health() {
    return Map.of("status", "UP");
  }
}
