package com.ax.rms.support;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpRequest.BodyPublishers;
import java.net.http.HttpResponse;
import java.net.http.HttpResponse.BodyHandlers;
import java.util.List;
import java.util.Map;

/**
 * 세션 쿠키({@code JSESSIONID}) 하나를 들고 다니는 작은 HTTP 클라이언트. 쿠키를 직접 다루므로 검사가 예전 세션 ID를
 * 다시 보내 볼 수 있다. 응답이 새 {@code JSESSIONID}를 주면 그것으로 바꾼다.
 */
public final class ApiClient {

  private static final ObjectMapper JSON = new ObjectMapper();
  private static final HttpClient HTTP =
      HttpClient.newBuilder().version(HttpClient.Version.HTTP_1_1).build();
  private static final String SESSION_COOKIE = "JSESSIONID=";

  private final int port;
  private String sessionId;

  /** {@code localhost:<port>}로 보내는, 쿠키 없는 클라이언트를 만든다. */
  public ApiClient(int port) {
    this.port = port;
  }

  /** 지금 들고 있는 세션 ID를 돌려준다. 없으면 {@code null}이다. */
  public String sessionId() {
    return sessionId;
  }

  /** 다음 요청부터 이 세션 ID를 보낸다. */
  public void useSessionId(String id) {
    this.sessionId = id;
  }

  /** {@code GET} 요청을 보낸다. */
  public Response get(String path) {
    return send("GET", path, null, null);
  }

  /** JSON 본문으로 요청을 보낸다. */
  public Response sendJson(String method, String path, String json) {
    return send(method, path, "application/json", json);
  }

  /** 아이디와 비밀번호로 {@code POST /api/auth/login}을 보낸다. */
  public Response login(String username, String password) {
    try {
      String body = JSON.writeValueAsString(Map.of("username", username, "password", password));
      return sendJson("POST", "/api/auth/login", body);
    } catch (IOException e) {
      throw new UncheckedIOException(e);
    }
  }

  /**
   * 요청을 보내고 응답을 돌려준다. {@code contentType}과 {@code body}는 {@code null}일 수 있다.
   *
   * @param method HTTP 메서드
   * @param path {@code /api/...}처럼 슬래시로 시작하는 경로와 질의 문자열
   * @param contentType 보낼 {@code Content-Type}
   * @param body 보낼 본문
   * @return 상태, 본문, {@code Set-Cookie} 헤더
   */
  public Response send(String method, String path, String contentType, String body) {
    HttpRequest.Builder builder =
        HttpRequest.newBuilder(URI.create("http://localhost:" + port + path))
            .method(method, body == null ? BodyPublishers.noBody() : BodyPublishers.ofString(body));
    if (contentType != null) {
      builder.header("Content-Type", contentType);
    }
    if (sessionId != null) {
      builder.header("Cookie", SESSION_COOKIE + sessionId);
    }
    try {
      HttpResponse<String> response = HTTP.send(builder.build(), BodyHandlers.ofString());
      List<String> setCookies = response.headers().allValues("Set-Cookie");
      for (String cookie : setCookies) {
        if (cookie.startsWith(SESSION_COOKIE)) {
          String value = cookie.substring(SESSION_COOKIE.length()).split(";", 2)[0];
          sessionId = value.isEmpty() ? null : value;
        }
      }
      return new Response(response.statusCode(), response.body(), setCookies);
    } catch (IOException e) {
      throw new UncheckedIOException(e);
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
      throw new IllegalStateException(e);
    }
  }

  /** 응답 하나. */
  public record Response(int status, String body, List<String> setCookies) {

    /** 본문을 JSON으로 읽는다. 본문이 없거나 JSON이 아니면 빈 노드를 돌려준다. */
    public JsonNode json() {
      try {
        return body == null || body.isBlank()
            ? JSON.createObjectNode()
            : JSON.readTree(body);
      } catch (IOException e) {
        return JSON.createObjectNode();
      }
    }

    /** {@code JSESSIONID}를 주는 {@code Set-Cookie} 헤더를 돌려준다. 없으면 {@code null}이다. */
    public String sessionCookie() {
      return setCookies.stream().filter(c -> c.startsWith(SESSION_COOKIE)).findFirst().orElse(null);
    }
  }
}
