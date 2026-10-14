# ax-rms — Workforce Planner

Working rules and project context: [AGENTS.md](AGENTS.md)

## 버전

- Java 21 (OpenJDK; 이 저장소에서 테스트한 버전: 21.0.12)
- Node 24 LTS (테스트한 버전: 24.21.0 — 저장소 루트의 `.nvmrc` 참고; `nvm use`로 맞춘다)
- npm 11 이상 (테스트한 버전: 11.19.0)
- Maven은 전역 설치가 필요 없다 — `backend/mvnw`(Maven Wrapper, Maven 3.10.0)만 쓴다. 첫 실행 때 지정된 Maven 배포판을 `~/.m2/wrapper/`에 내려받는다.
- Playwright 1.64.0 (`@playwright/test`, e2e 검사와 스크린샷) — Chromium headless shell을 쓴다.
- perl 5 (`scripts/e2e-servers.sh`의 실행 잠금, 테스트한 버전: 5.40.1) — Ubuntu와 macOS에 기본으로 있다.
- 글꼴: Pretendard 1.3.9 (npm `pretendard`, OFL-1.1) — 앱 번들에 들어가며 외부 CDN을 쓰지 않는다.
- 라우터: React Router 8.4.0 (npm `react-router`).
- 인증: Spring Security 6.5.11 (`spring-boot-starter-security`, Spring Boot 3.5.16이 정하는 버전).

## 설치

```
npm --prefix frontend install
npx --prefix frontend playwright install chromium
```

두 번째 명령은 e2e 검사(`make test`)와 `make screenshots`가 쓰는 브라우저를 `~/.cache/ms-playwright`(또는 `PLAYWRIGHT_BROWSERS_PATH`)에 내려받는다. Linux에서 브라우저를 띄울 시스템 라이브러리가 없다는 오류가 나면 `npx --prefix frontend playwright install-deps chromium`(sudo 필요)으로 설치한다.

백엔드 의존성(Spring Boot, `org.xerial:sqlite-jdbc` 등)은 `./backend/mvnw`를 처음 실행할 때 자동으로 받는다. 따로 설치할 것은 없다.

## DB 준비

SQLite는 파일 하나로 동작하며 앱을 처음 실행할 때 비어 있는 파일이 만들어진다. 따로 준비할 것은 없다. 기본 위치는 `backend/data/app.db`이며 git에 포함되지 않는다(`.gitignore`).

## 실행 (로컬 데모)

**백엔드** (포트를 `8080`으로 고정 — 프런트엔드가 이 주소로 호출한다):

```
scripts/nexi-isolated.sh --root "$PWD" --file DB_PATH=backend/data/app.db --set SERVER_PORT=8080 \
  -- ./backend/mvnw -f backend/pom.xml spring-boot:run
```

**프런트엔드** (다른 터미널):

```
npm --prefix frontend run dev
```

브라우저에서 `http://localhost:5173`(Vite 기본 포트)을 열면 로그인 화면이 먼저 나온다. 아래 데모 계정으로 로그인하면 관리자 역할이 있는 계정은 `/`(지금은 디자인 참조 화면, 백엔드 `/api/health` 상태 표시)로, 직원 역할만 있는 계정은 `/me`(내 정보)로 간다. 개발 서버는 `/api`를 `http://localhost:8080`으로 proxy한다(`frontend/vite.config.ts`의 `server.proxy`), 그래서 브라우저에서 보는 주소는 그대로 `/api/...`다.

## 데모 계정 (D31)

빈 DB로 처음 실행하면 아래 4개 데모 계정이 시드로 들어간다(비밀번호는 BCrypt로 해시 저장, 평문은 데모 전용이다). 로그인 화면(`/login`)에서 이 아이디와 비밀번호로 들어간다.

| 아이디 | 비밀번호 | 역할 |
|---|---|---|
| `hr.manager` | `HrManager!1` | 직원, 인력 관리자 |
| `project.manager` | `ProjectManager!1` | 직원, 프로젝트 관리자 |
| `employee.demo` | `Employee!1` | 직원 |
| `dual.manager` | `DualManager!1` | 직원, 인력 관리자, 프로젝트 관리자 (겸임) |

## 인증과 권한 (D16, D9, D25)

로그인은 서버 세션으로 유지한다. 세션 쿠키 `JSESSIONID`는 `HttpOnly`, `SameSite=Strict`, `Path=/`이다(로컬 http 시연이라 `Secure`는 두지 않는다). CSRF 토큰은 쓰지 않는다: `SameSite=Strict` 쿠키는 다른 사이트에서 온 요청에 붙지 않고, 로그인은 JSON만 받는다.

| API | 응답 |
|---|---|
| `POST /api/auth/login` (`Content-Type: application/json`, `{"username", "password"}`) | 200 `{"username", "employeeId", "employeeName", "roles"}`. 틀린 비밀번호와 없는 계정은 같은 401 `AUTH_INVALID_CREDENTIALS`, 빈 값은 400 `AUTH_INVALID_REQUEST`, JSON이 아니면 415 `UNSUPPORTED_MEDIA_TYPE`. 이미 세션이 있었으면 세션 ID를 새로 발급한다. |
| `GET /api/auth/me` | 로그인 중이면 200(로그인 응답과 같은 본문), 아니면 401 `AUTH_REQUIRED` |
| `POST /api/auth/logout` | 204. 세션을 없앤다. |

인증 API의 오류와 401·403·415 응답의 본문은 `{"code": "...", "message": "..."}`이다(D33). 로그인이 없으면 401 `AUTH_REQUIRED`, 권한이 없으면 403 `AUTH_FORBIDDEN`, JSON이 아닌 본문은 415 `UNSUPPORTED_MEDIA_TYPE`이다. 권한 단계를 지난 요청에 아직 처리기가 없으면(404 등) Spring 기본 오류 본문이 나간다. 이후 API 태스크는 자기 오류를 이 형식으로 답한다.

모든 `/api` 요청의 권한은 `backend/src/main/java/com/ax/rms/security/ApiSecurityFilterChain.java` 한 곳에서 정한다. 표에 없는 요청은 막는다. 이후 API는 이 경로 아래에 두고, 새 경로가 필요하면 이 표를 함께 바꾼다.

| 요청 | 비로그인 | 직원만 | 인력 관리자 | 프로젝트 관리자 | 겸임 |
|---|---|---|---|---|---|
| `GET /api/health`, `POST /api/auth/login` | 허용 | 허용 | 허용 | 허용 | 허용 |
| `GET /api/auth/me`, `POST /api/auth/logout` | 401 | 허용 | 허용 | 허용 | 허용 |
| `GET /api/me/**` (본인 데이터, 경로에 ID 없음) | 401 | 허용 | 허용 | 허용 | 허용 |
| `GET /api/employees/**`, `/api/projects/**`, `/api/assignments/**`, `/api/dashboard/**`, `/api/departments/**` | 401 | 403 | 허용 | 허용 | 허용 |
| `POST`·`PUT`·`PATCH`·`DELETE /api/employees/**` | 401 | 403 | 허용 | 403 | 허용 |
| `POST`·`PUT`·`PATCH`·`DELETE /api/projects/**`, `/api/assignments/**` | 401 | 403 | 403 | 허용 | 허용 |
| 그 밖의 모든 요청 | 401 | 403 | 403 | 403 | 403 |

화면은 로그인하지 않으면 `/login`만 보인다. 직원 역할만 있는 계정은 내 정보(`/me`)만 보고, 다른 주소를 열면 `/me`로 간다.

## 검사

```
make build
make test
make lint
```

`make test`는 백엔드 테스트, Vitest, 그리고 e2e 검사(`npm --prefix frontend run test:e2e`, Playwright)를 차례로 실행한다. e2e 검사는 아래 "e2e 서버"대로 자기 서버를 띄우고 내린다. 세 단계다: 공유 DB(`backend/data/e2e.db`)로 `e2e` 프로젝트를 돌린 뒤, `--fresh-db`의 실행별 DB로 실제 저장 검사(`frontend/e2e/write/`, `e2e-write` 프로젝트)를 돌리고, 다시 새로 만든 실행별 DB로 원문 §10의 시연 흐름(`frontend/e2e/flow/`, `e2e-flow` 프로젝트, `npm --prefix frontend run e2e:flow`)을 돌린다. 시연 흐름은 시드만 들어간 DB에서 시작해야 하므로 저장 검사와 DB를 함께 쓰지 않는다. 공유 DB 단계의 스펙은 직원 쓰기를 서버에 보내지 않는다. 백엔드는 Tomcat이 뜬 뒤에 시드를 넣으므로, Playwright `globalSetup`(`frontend/e2e/global-setup.ts`)이 데모 계정 로그인이 될 때까지 최대 30초 기다린 뒤 검사를 시작한다. 로그인이 필요한 화면의 e2e·스크린샷은 `frontend/e2e/support/auth.ts`의 `loginAs`로 먼저 로그인한다.

## 스크린샷

```
make screenshots T=<N>
```

`frontend/e2e/screens/T<N>.spec.ts`가 정한 화면을 찍어 `docs/screens/T<N>/`에 PNG로 저장한다. 서버는 아래 "e2e 서버"대로 `--fresh-db`로 띄우고 내린다: 모든 스크린샷 실행은 이번 실행만 쓰는 새 DB(`.nexi-tmp/e2e-write.db`, 시드가 들어간다)를 쓰고 공유 DB `backend/data/e2e.db`를 건드리지 않는다. 그래서 실제 저장 뒤의 화면(T#19의 배치 전후)도 찍을 수 있다. `T`가 없거나 그 스펙 파일이 없으면 아무것도 띄우지 않고 실패한다.

## e2e 서버 — `scripts/e2e-servers.sh`

e2e 검사와 스크린샷은 `scripts/e2e-servers.sh [--fresh-db] -- <명령>`으로 실행한다. 선택이 없으면 백엔드 DB는 한 번 만든 뒤 계속 쓰는 `backend/data/e2e.db`이고 명령 환경에 `E2E_DB`를 두지 않는다. `--fresh-db`면 DB는 이번 실행만 쓰는 `.nexi-tmp/e2e-write.db`(빈 DB라 백엔드가 시드를 넣는다)이고 명령을 `E2E_DB=fresh` 환경으로 실행한다. `frontend/e2e/write/`·`frontend/e2e/flow/` 스펙과 `frontend/e2e/screens/T19.spec.ts`는 `E2E_DB=fresh`가 아니면 요청 없이 실패한다. `make test`의 공유 DB 단계만 선택 없이 돌고, 저장 검사·시연 흐름 단계와 `make screenshots`는 `--fresh-db`로 돈다. 이 스크립트는 다음 순서로 동작한다.

1. `.nexi-tmp`와 그 안의 출력 파일(`e2e-servers.lock`, `e2e-servers.pids`, `e2e-backend.log`, `e2e-preview.log`, `--fresh-db`면 `e2e-write.db`와 그 `-journal`·`-wal`·`-shm`)이 심볼릭 링크이거나 일반 파일·폴더가 아니거나 저장소 밖을 가리키면 `출력 경로 거부` 메시지를 내고 아무것도 쓰거나 띄우지 않은 채 실패한다(exit 2).
2. 모든 실행(`--fresh-db` 유무, `make screenshots` 포함)이 함께 쓰는 `.nexi-tmp/e2e-servers.lock`의 배타 잠금(`flock`)을 기다리지 않고 잡는다. 다른 실행이 잡고 있으면 `다른 e2e-servers 실행이 진행 중` 메시지를 내고 아무것도 지우거나 쓰거나 띄우지 않은 채 실패한다(exit 1). 잠금은 이 스크립트 프로세스가 끝날 때(7단계의 정리 뒤) 풀리고, 강제로 끝나도 커널이 푼다. 서버·빌드·명령은 잠금을 물려받지 않는다. 그래서 두 실행이 겹치지 않고, 쓰이고 있는 DB 파일을 다른 실행이 지우지 않는다. 잠금 파일은 지우지 않는다.
3. 포트 `18080`(백엔드)과 `14173`(프런트엔드)이 비어 있는지 확인한다. 하나라도 쓰이고 있으면 `포트 <번호> 사용 중` 메시지를 내고 아무것도 띄우지 않은 채 실패한다. 그 포트를 쓰는 프로세스는 건드리지 않는다.
4. `--fresh-db`면 그 DB 파일 넷을 지운다. `npm --prefix frontend run build`로 지금 소스를 빌드한다. 실패하면 서버를 띄우지 않는다.
5. 백엔드(`scripts/nexi-isolated.sh`, DB 파일 `backend/data/e2e.db` 또는 `--fresh-db`면 `.nexi-tmp/e2e-write.db`, 포트 18080)와 방금 빌드한 프런트엔드의 `vite preview`(포트 14173, `/api`는 `API_TARGET=http://localhost:18080`으로 프록시)를 각각 자기 프로세스 그룹으로 띄우고, 두 그룹 ID를 `.nexi-tmp/e2e-servers.pids`에 적는다.
6. `http://localhost:14173/api/health`가 응답할 때까지 기다린 뒤 명령을 실행한다. 전체 대기는 최대 120초다. 요청마다 그 마감 시각에 끊으므로, 연결만 받고 응답하지 않는 서버가 있어도 120초를 넘지 않는다. 시간을 넘기면 이번 실행이 띄운 서버를 내리고 실패한다.
7. 끝나면(성공·실패·Ctrl-C·TERM) 기록한 두 그룹에만 TERM을 보내고, 10초 안에 끝나지 않으면 KILL을 보낸다. 포트나 이름으로 프로세스를 찾아 죽이지 않는다. `--fresh-db`면 그 뒤 DB 파일 넷을 다시 지운다. 1–3단계에서 멈췄으면 아무 파일도 지우지 않는다.

서버 로그는 `.nexi-tmp/e2e-backend.log`, `.nexi-tmp/e2e-preview.log`에 남는다.

## 검사 격리 — `scripts/nexi-isolated.sh` runner 옵션

검사(빌드·테스트·clean-copy 검증)가 건드릴 수 있는 대상과, 키트 스크립트 `scripts/nexi-isolated.sh --root <dir> [--set VAR=VALUE] [--file VAR=RELPATH] [--file-url VAR=RELPATH] [--keep VAR] [--home keep|isolated] -- <명령...>`로 각각을 고르는 옵션:

| 대상 | 기본값/정하는 법 | `nexi-isolated.sh` 옵션 |
|---|---|---|
| SQLite DB 파일 | `<root>/backend/data/app.db` | `--file DB_PATH=backend/data/app.db` → 환경변수 `DB_PATH`에 `<root>` 안의 절대경로가 들어감(`application.yml`의 `spring.datasource.url: jdbc:sqlite:${DB_PATH:./data/app.db}`가 이를 읽는다) |
| 백엔드 서버 포트 | 테스트: `0`(OS가 빈 포트 자동 할당). 이 README대로 앱을 띄울 때: `8080`(고정값). e2e·스크린샷: `18080` | 테스트: `--set SERVER_PORT=0`; 데모 실행: `--set SERVER_PORT=8080`; e2e·스크린샷: `scripts/e2e-servers.sh`가 `--set SERVER_PORT=18080`으로 띄운다 |
| e2e 공유 DB 파일 | `<root>/backend/data/e2e.db` | `scripts/e2e-servers.sh`(선택 없음)가 `--file DB_PATH=backend/data/e2e.db`로 띄운다. `make test`의 공유 DB 단계(`e2e` 프로젝트)만 쓴다 |
| e2e 실행별 DB 파일(저장 검사·시연 흐름·스크린샷) | `<root>/.nexi-tmp/e2e-write.db`, 실행마다 새로 만들고 끝나면 지운다(`-journal`·`-wal`·`-shm` 포함) | `scripts/e2e-servers.sh --fresh-db`가 `--file DB_PATH=.nexi-tmp/e2e-write.db`로 띄우고 명령에 `E2E_DB=fresh`를 준다. `npm --prefix frontend run test:e2e`(`make test`)가 공유 DB 단계 다음에 이 방식으로 `frontend/e2e/write/` 스펙(`e2e-write`)을, 그 다음 새 실행으로 `frontend/e2e/flow/` 스펙(`e2e-flow`)을 돌린다. `make screenshots T=<N>`도 이 방식으로 돈다 |
| e2e·스크린샷 프런트엔드 | `vite preview --port 14173 --strictPort`, `/api` 프록시 대상 `http://localhost:18080` | `scripts/e2e-servers.sh`가 `API_TARGET=http://localhost:18080`으로 띄운다(`frontend/vite.config.ts`; 없으면 개발 서버와 같은 `http://localhost:8080`) |
| e2e 서버 기록 | `<root>/.nexi-tmp/e2e-servers.pids`(이번 실행이 띄운 프로세스 그룹 ID) | `scripts/e2e-servers.sh`가 실행마다 덮어쓴다 |
| e2e 서버 잠금 | `<root>/.nexi-tmp/e2e-servers.lock`(빈 파일, 지우지 않는다) | `scripts/e2e-servers.sh`가 실행 내내 배타 잠금을 잡는다. 잡혀 있으면 다음 실행은 아무것도 건드리지 않고 거부된다 |
| Playwright 브라우저 | `~/.cache/ms-playwright` | 격리 실행에서는 `--set PLAYWRIGHT_BROWSERS_PATH=<root>/.nexi-home/ms-playwright` |
| 스크린샷 | `docs/screens/T<N>/` | `make screenshots T=<N>` |
| HOME·임시 디렉터리 | `<root>/.nexi-home`, `<root>/.nexi-tmp`(스크립트 기본값) | 옵션 없이 기본값 사용 |
| 빌드 산출물 폴더 | `backend/target/`, `frontend/node_modules/`, `frontend/dist/`, `frontend/test-results/` | `--root` 안에만 생성, `.gitignore`로 제외 |
| 외부 서비스 | 없음 | 이 프로젝트는 외부 시스템을 쓰지 않는다 |

스크립트가 환경을 비우고(`env -i`) 지정한 변수만 넘기므로, 호출 셸의 `DATABASE_URL`이나 다른 `SPRING_*`/포트 변수는 자식 프로세스에 전달되지 않는다.

## 클린 카피 확인 (참고용 명령)

새로 clone한 폴더에서 이 순서(설치·브라우저 설치 → `make build` → `make test` → `make lint`)를 그대로 실행한 뒤 `git status --porcelain --untracked-files=all`이 빈 출력이어야 한다:

```
scripts/nexi-isolated.sh --root <clone 경로> --file DB_PATH=backend/data/app.db --set SERVER_PORT=0 \
  --set PLAYWRIGHT_BROWSERS_PATH=<clone 경로>/.nexi-home/ms-playwright -- bash -c '
  cd <clone 경로> &&
  npm --prefix frontend install &&
  npx --prefix frontend playwright install chromium &&
  make build && make test && make lint
'
git -C <clone 경로> status --porcelain --untracked-files=all
```
