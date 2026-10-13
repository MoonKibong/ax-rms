# ax-rms — Workforce Planner

Working rules and project context: [AGENTS.md](AGENTS.md)

## 버전

- Java 21 (OpenJDK; 이 저장소에서 테스트한 버전: 21.0.12)
- Node 24 LTS (테스트한 버전: 24.21.0 — 저장소 루트의 `.nvmrc` 참고; `nvm use`로 맞춘다)
- npm 11 이상 (테스트한 버전: 11.19.0)
- Maven은 전역 설치가 필요 없다 — `backend/mvnw`(Maven Wrapper, Maven 3.10.0)만 쓴다. 첫 실행 때 지정된 Maven 배포판을 `~/.m2/wrapper/`에 내려받는다.
- Playwright 1.64.0 (`@playwright/test`, e2e 검사와 스크린샷) — Chromium headless shell을 쓴다.
- 글꼴: Pretendard 1.3.9 (npm `pretendard`, OFL-1.1) — 앱 번들에 들어가며 외부 CDN을 쓰지 않는다.

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

브라우저에서 `http://localhost:5173`(Vite 기본 포트)을 열면 첫 화면(디자인 참조 화면)이 백엔드의 `/api/health`를 호출해 상태를 보여준다. 개발 서버는 `/api`를 `http://localhost:8080`으로 proxy한다(`frontend/vite.config.ts`의 `server.proxy`), 그래서 브라우저에서 보는 주소는 그대로 `/api/...`다.

## 데모 계정 (D31)

빈 DB로 처음 실행하면 아래 4개 데모 계정이 시드로 들어간다(비밀번호는 BCrypt로 해시 저장, 평문은 데모 전용이다). 로그인 화면·API는 T#6에서 만들어지며, 지금은 데이터로만 존재한다.

| 아이디 | 비밀번호 | 역할 |
|---|---|---|
| `hr.manager` | `HrManager!1` | 직원, 인력 관리자 |
| `project.manager` | `ProjectManager!1` | 직원, 프로젝트 관리자 |
| `employee.demo` | `Employee!1` | 직원 |
| `dual.manager` | `DualManager!1` | 직원, 인력 관리자, 프로젝트 관리자 (겸임) |

## 검사

```
make build
make test
make lint
```

`make test`는 백엔드 테스트, Vitest, 그리고 e2e 검사(`npm --prefix frontend run test:e2e`, Playwright)를 차례로 실행한다. e2e 검사는 아래 "e2e 서버"대로 자기 서버를 띄우고 내린다.

## 스크린샷

```
make screenshots T=<N>
```

`frontend/e2e/screens/T<N>.spec.ts`가 정한 화면을 찍어 `docs/screens/T<N>/`에 PNG로 저장한다. 서버는 아래 "e2e 서버"대로 띄우고 내린다. `T`가 없거나 그 스펙 파일이 없으면 아무것도 띄우지 않고 실패한다.

## e2e 서버 — `scripts/e2e-servers.sh`

e2e 검사와 스크린샷은 `scripts/e2e-servers.sh -- <명령>`으로 실행한다. 이 스크립트는 다음 순서로 동작한다.

1. `.nexi-tmp`와 그 안의 출력 파일(`e2e-servers.pids`, `e2e-backend.log`, `e2e-preview.log`)이 심볼릭 링크이거나 일반 파일·폴더가 아니거나 저장소 밖을 가리키면 `출력 경로 거부` 메시지를 내고 아무것도 쓰거나 띄우지 않은 채 실패한다(exit 2).
2. 포트 `18080`(백엔드)과 `14173`(프런트엔드)이 비어 있는지 확인한다. 하나라도 쓰이고 있으면 `포트 <번호> 사용 중` 메시지를 내고 아무것도 띄우지 않은 채 실패한다. 그 포트를 쓰는 프로세스는 건드리지 않는다.
3. `npm --prefix frontend run build`로 지금 소스를 빌드한다. 실패하면 서버를 띄우지 않는다.
4. 백엔드(`scripts/nexi-isolated.sh`, DB 파일 `backend/data/e2e.db`, 포트 18080)와 방금 빌드한 프런트엔드의 `vite preview`(포트 14173, `/api`는 `API_TARGET=http://localhost:18080`으로 프록시)를 각각 자기 프로세스 그룹으로 띄우고, 두 그룹 ID를 `.nexi-tmp/e2e-servers.pids`에 적는다.
5. `http://localhost:14173/api/health`가 응답할 때까지 기다린 뒤 명령을 실행한다. 전체 대기는 최대 120초다. 요청마다 그 마감 시각에 끊으므로, 연결만 받고 응답하지 않는 서버가 있어도 120초를 넘지 않는다. 시간을 넘기면 이번 실행이 띄운 서버를 내리고 실패한다.
6. 끝나면(성공·실패·Ctrl-C·TERM) 기록한 두 그룹에만 TERM을 보내고, 10초 안에 끝나지 않으면 KILL을 보낸다. 포트나 이름으로 프로세스를 찾아 죽이지 않는다.

서버 로그는 `.nexi-tmp/e2e-backend.log`, `.nexi-tmp/e2e-preview.log`에 남는다.

## 검사 격리 — `scripts/nexi-isolated.sh` runner 옵션

검사(빌드·테스트·clean-copy 검증)가 건드릴 수 있는 대상과, 키트 스크립트 `scripts/nexi-isolated.sh --root <dir> [--set VAR=VALUE] [--file VAR=RELPATH] [--file-url VAR=RELPATH] [--keep VAR] [--home keep|isolated] -- <명령...>`로 각각을 고르는 옵션:

| 대상 | 기본값/정하는 법 | `nexi-isolated.sh` 옵션 |
|---|---|---|
| SQLite DB 파일 | `<root>/backend/data/app.db` | `--file DB_PATH=backend/data/app.db` → 환경변수 `DB_PATH`에 `<root>` 안의 절대경로가 들어감(`application.yml`의 `spring.datasource.url: jdbc:sqlite:${DB_PATH:./data/app.db}`가 이를 읽는다) |
| 백엔드 서버 포트 | 테스트: `0`(OS가 빈 포트 자동 할당). 이 README대로 앱을 띄울 때: `8080`(고정값). e2e·스크린샷: `18080` | 테스트: `--set SERVER_PORT=0`; 데모 실행: `--set SERVER_PORT=8080`; e2e·스크린샷: `scripts/e2e-servers.sh`가 `--set SERVER_PORT=18080`으로 띄운다 |
| e2e·스크린샷 DB 파일 | `<root>/backend/data/e2e.db` | `scripts/e2e-servers.sh`가 `--file DB_PATH=backend/data/e2e.db`로 띄운다 |
| e2e·스크린샷 프런트엔드 | `vite preview --port 14173 --strictPort`, `/api` 프록시 대상 `http://localhost:18080` | `scripts/e2e-servers.sh`가 `API_TARGET=http://localhost:18080`으로 띄운다(`frontend/vite.config.ts`; 없으면 개발 서버와 같은 `http://localhost:8080`) |
| e2e 서버 기록 | `<root>/.nexi-tmp/e2e-servers.pids`(이번 실행이 띄운 프로세스 그룹 ID) | `scripts/e2e-servers.sh`가 실행마다 덮어쓴다 |
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
