상태: 승인
근거: 계약 T#56 승인

# 오류 처리 기준

이 문서는 승인된 계약 `docs/contracts/T56.md`의 "오류 처리 기준"을 옮겨 적은 것이다. 기준을 바꾸려면 새 변경 이슈가 계약서를 다시 승인받는다. 패키지 공개 경계, 주석 규칙, 로깅 전반은 이 문서의 범위가 아니다.

## 예외

1. 업무 규칙 위반과 없는 리소스는 `com.ax.rms.web.ApiException(HttpStatus status, String code, String message)` 하나로 던진다. 패키지별 예외 클래스를 새로 만들지 않는다.
2. `@RestControllerAdvice`는 `com.ax.rms.web`에 하나만 둔다(`ApiErrorHandler`). 컨트롤러 안의 `@ExceptionHandler`는 두지 않는다. 단 하나의 예외: `AuthController`의 읽을 수 없는 로그인 본문 → 400 `AUTH_INVALID_REQUEST`(T#6 계약, 빈 값과 같은 응답).
3. 요청 record는 필수 값에 원시 타입(`long`, `int`)을 쓰지 않고 래퍼 타입을 쓴다. 빠진 값은 서비스가 그 API의 요청 오류 코드로 400을 답한다(0으로 읽혀 엉뚱한 오류가 나지 않게).
4. 목록 안의 `null` 요소는 그 목록의 항목 오류 코드로 400이다(`skills`의 `null` → `EMPLOYEE_SKILL_INVALID`).

## 오류 응답

1. 모든 `/api/**` 오류 응답의 본문은 키가 `code`, `message` 둘뿐이다. `message`는 한국어이고 예외 클래스 이름·스택·SQL·내부 경로를 담지 않는다.
2. 전역 처리기(`ResponseEntityExceptionHandler`를 확장)는 아래 표대로 답한다. 같은 잘못된 요청은 API가 달라도 같은 응답이다.

   | 원인 | 상태 | code | message |
   |---|---|---|---|
   | `ApiException` | 예외의 값 | 예외의 값 | 예외의 값 |
   | 읽을 수 없는 본문, 형식이 틀린 경로·질의 값, 빠진 필수 질의 값 | 400 | `REQUEST_INVALID` | 요청 형식이 올바르지 않습니다. |
   | 지원하지 않는 `Content-Type` | 415 | `UNSUPPORTED_MEDIA_TYPE` | 요청 본문은 JSON으로 보내야 합니다. |
   | 없는 경로 | 404 | `NOT_FOUND` | 요청한 주소를 찾을 수 없습니다. |
   | 지원하지 않는 메서드 | 405 | `METHOD_NOT_ALLOWED` | 지원하지 않는 요청 방식입니다. (`Allow` 헤더 유지) |
   | `SQLITE_BUSY` | 409 | `DB_BUSY` | 다른 작업이 처리 중입니다. 잠시 후 다시 시도하세요. |
   | 그 밖의 처리 안 된 예외 | 500 | `INTERNAL_ERROR` | 서버 오류가 발생했습니다. 잠시 후 다시 시도하세요. |

3. 위 표에 없는 Spring MVC 표준 예외도 Spring이 정한 상태를 지키고 본문만 `{code,message}`로 바꾼다(406 `NOT_ACCEPTABLE`, 그 밖의 4xx는 `REQUEST_INVALID`).
4. `AccessDeniedException`·`AuthenticationException`은 전역 처리기가 삼키지 않고 보안 설정(`ApiSecurityFilterChain`)이 답한다. 401 `AUTH_REQUIRED`, 403 `AUTH_FORBIDDEN`.
5. 인증 중 저장소 오류는 401로 가리지 않는다. 틀린 계정·비밀번호만 401 `AUTH_INVALID_CREDENTIALS`다.
6. 로그: 500은 `ERROR`로 예외와 스택을 남기고, 409 `DB_BUSY`는 `WARN`으로 한 줄 남긴다. 4xx 업무 오류는 로그를 남기지 않는다.

## 트랜잭션

1. 한 요청에서 쓰기를 둘 이상 하는 서비스 메서드는 `@Transactional`이다. 읽기 전용 서비스는 필요할 때 `readOnly`를 쓴다.
2. 트랜잭션 안에서 던진 `ApiException`은 롤백된다(런타임 예외 기본 동작).

이 절은 규칙만 적는다. 직원 등록·수정·상태 변경과 시드에 적용하는 구현, WAL·`busy_timeout` 같은 SQLite 동시성 설정은 #54가 한다.

## API 클라이언트

1. 서버 오류 본문 `{code,message}`를 읽는 일은 `frontend/src/api`의 한 곳에서 한다. 새 코드는 호출부마다 복제하지 않는다. 401은 그 한 곳에서 처리한다.
2. 화면은 `message`를 그대로 보이고, `code`는 입력 근처에 붙이는 분기에만 쓴다. 모르는 `code`와 `code`가 없는 응답은 "저장하지 못했습니다. 잠시 후 다시 시도하세요."로 보인다.

이 절은 규칙만 적는다. 프런트엔드 구현(`frontend/src/api`의 한 곳, 401 처리)은 #55가 한다.
