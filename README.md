# ax-rms — Workforce Planner

Working rules and project context: [AGENTS.md](AGENTS.md)

## 버전

- Java 21 (OpenJDK; 이 저장소에서 테스트한 버전: 21.0.12)
- Node 24 LTS (테스트한 버전: 24.21.0 — 저장소 루트의 `.nvmrc` 참고; `nvm use`로 맞춘다)
- npm 11 이상 (테스트한 버전: 11.19.0)
- Maven은 전역 설치가 필요 없다 — `backend/mvnw`(Maven Wrapper, Maven 3.10.0)만 쓴다. 첫 실행 때 지정된 Maven 배포판을 `~/.m2/wrapper/`에 내려받는다.

## 설치

```
npm --prefix frontend install
```

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

브라우저에서 `http://localhost:5173`(Vite 기본 포트)을 열면 첫 화면이 백엔드의 `/api/health`를 호출해 상태를 보여준다. 개발 서버는 `/api`를 `http://localhost:8080`으로 proxy한다(`frontend/vite.config.ts`의 `server.proxy`), 그래서 브라우저에서 보는 주소는 그대로 `/api/...`다.

## 검사

```
make build
make test
make lint
```

## 검사 격리 — `scripts/nexi-isolated.sh` runner 옵션

검사(빌드·테스트·clean-copy 검증)가 건드릴 수 있는 대상과, 키트 스크립트 `scripts/nexi-isolated.sh --root <dir> [--set VAR=VALUE] [--file VAR=RELPATH] [--file-url VAR=RELPATH] [--keep VAR] [--home keep|isolated] -- <명령...>`로 각각을 고르는 옵션:

| 대상 | 기본값/정하는 법 | `nexi-isolated.sh` 옵션 |
|---|---|---|
| SQLite DB 파일 | `<root>/backend/data/app.db` | `--file DB_PATH=backend/data/app.db` → 환경변수 `DB_PATH`에 `<root>` 안의 절대경로가 들어감(`application.yml`의 `spring.datasource.url: jdbc:sqlite:${DB_PATH:./data/app.db}`가 이를 읽는다) |
| 백엔드 서버 포트 | 테스트: `0`(OS가 빈 포트 자동 할당). 이 README대로 앱을 띄울 때: `8080`(고정값) | 테스트: `--set SERVER_PORT=0`; 데모 실행: `--set SERVER_PORT=8080` |
| HOME·임시 디렉터리 | `<root>/.nexi-home`, `<root>/.nexi-tmp`(스크립트 기본값) | 옵션 없이 기본값 사용 |
| 빌드 산출물 폴더 | `backend/target/`, `frontend/node_modules/`, `frontend/dist/` | `--root` 안에만 생성, `.gitignore`로 제외 |
| 외부 서비스 | 없음 | 이 프로젝트는 외부 시스템을 쓰지 않는다 |

스크립트가 환경을 비우고(`env -i`) 지정한 변수만 넘기므로, 호출 셸의 `DATABASE_URL`이나 다른 `SPRING_*`/포트 변수는 자식 프로세스에 전달되지 않는다.

## 클린 카피 확인 (참고용 명령)

새로 clone한 폴더에서 이 순서(설치 → `make build` → `make test` → `make lint`)를 그대로 실행한 뒤 `git status --porcelain --untracked-files=all`이 빈 출력이어야 한다:

```
scripts/nexi-isolated.sh --root <clone 경로> --file DB_PATH=backend/data/app.db --set SERVER_PORT=0 -- bash -c '
  cd <clone 경로> &&
  npm --prefix frontend install &&
  make build && make test && make lint
'
git -C <clone 경로> status --porcelain --untracked-files=all
```
