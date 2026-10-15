상태: 승인

# 최종 보고서 — ax-rms Workforce Planner

- 날짜: 2026-10-15
- 검사한 `main`: `f3f00949f7243b2c7b91085f6c1f19254849515b`
- 키트: 8a06acc6982d
- 모드: team, PM `MoonKibong`

## 검사 결과 — 새로 clone한 폴더

`origin`을 저장소 밖 임시 폴더에 새로 clone했다(HEAD `f3f00949f7243b2c7b91085f6c1f19254849515b` = `origin/main`, 이 폴더에서 아무 파일도
복사하지 않음). README "클린 카피 확인"의 순서와 runner 옵션대로 모든 명령을
`nexi-isolated.sh --root <clone> --file DB_PATH=backend/data/app.db --set SERVER_PORT=0 --set PLAYWRIGHT_BROWSERS_PATH=<clone>/.nexi-home/ms-playwright`로
실행했다(명령마다 10분 제한).

runner가 남긴 줄: `dropped: CARGO_REGISTRY_TOKEN CEREBRAS_API_KEY CLAUDE_CODE_MESSAGING_TOKEN CLOUDFLARE_WORKERS_AI_TOKEN GITHUB_MODELS_API_KEY
GROQ_API_KEY HYPERBOLIC_API_KEY NIM_API_KEY OLLAMA_API_KEY OPENROUTER_API_KEY POSTGRES SAMBANOVA_API_KEY SILICONFLOW_API_KEY ; passed: DB_PATH HOME LANG
LOGNAME PATH PLAYWRIGHT_BROWSERS_PATH SERVER_PORT TERM TMPDIR USER XDG_CACHE_HOME XDG_CONFIG_HOME`

사용한 버전: OpenJDK 21.0.11(README가 테스트한 21.0.12와 같은 Java 21), Node 24.21.0, npm 11.19.0, Maven 3.10.0(`backend/mvnw`), perl 5.34.1,
Playwright 1.64.0(Chrome Headless Shell 156.0.8078.4). macOS 26.3.1.

| 단계 | 명령 | 종료 코드 | 결과 (마지막 줄) |
|---|---|---|---|
| 설치 | `npm --prefix frontend install` | 0 | `added 201 packages, and audited 202 packages in 3s` |
| 브라우저 설치 | `npx --prefix frontend playwright install chromium` | 0 | `Chrome Headless Shell 156.0.8078.4 … downloaded to <clone>/.nexi-home/ms-playwright/chromium_headless_shell-1248` |
| DB 준비 | (README: 따로 할 것 없음, 앱이 처음 실행할 때 빈 파일을 만들고 시드를 넣는다) | — | 실행할 명령 없음 |
| 빌드 | `make build` | 0 | `BUILD SUCCESS`, `✓ built in 682ms` |
| 테스트 | `make test` | 0 | 백엔드 `Tests run: 227, Failures: 0, Errors: 0, Skipped: 0`, Vitest `Tests 344 passed (344)`, e2e `137 passed (2.2m)`, e2e-write `15 passed (19.6s)`, e2e-flow `3 passed (5.3s)` |
| 린트 | `make lint` | 0 | checkstyle 통과, `eslint .` 출력 없음 |
| 작업 트리 | `git status --porcelain --untracked-files=all` (runner 폴더 `.nexi-home/`·`.nexi-tmp/` 제외) | — | 빈 출력 |
| 실행 | README "실행 (로컬 데모)": 백엔드 `nexi-isolated.sh --root <clone> --file DB_PATH=backend/data/app.db --set SERVER_PORT=8080 --set SERVER_ADDRESS=127.0.0.1 -- ./backend/mvnw -f backend/pom.xml spring-boot:run`, 프런트엔드 `nexi-isolated.sh --root <clone> -- npm --prefix frontend run dev` | 통과 | 시작 전 8080·5173 비어 있음. 백엔드 `127.0.0.1:8080` `/api/health` → `{"status":"UP"}`, 프런트엔드 `[::1]:5173` 제목 `Workforce Planner`, 프록시 `/api/health` → `{"status":"UP"}`(듣는 프로세스가 띄운 프로세스의 자식임을 확인). 내린 뒤 두 포트 비어 있음 — 처음 종료 명령이 감싼 subshell의 그룹에 보내져 서버가 남았고, 띄운 두 프로세스 그룹(Maven 70936, vite 70938, 둘 다 clone 폴더의 명령)에 다시 TERM을 보내 내렸다 |

외부 시스템을 쓰는 단계는 없다(README "외부 서비스: 없음", D40).

주소: README의 백엔드 실행 명령은 주소를 정하지 않아 Spring Boot 기본값(모든 네트워크 인터페이스)으로 듣는다. 이 컴퓨터에만 열기 위해 `--set SERVER_ADDRESS=127.0.0.1`을 더했다(포트 8080은 그대로). 프런트엔드 개발 서버는 기본으로 `localhost`에만 연다.

## 검사 결과 — 이 폴더 (`/Users/kibong/development/ax-rms`)

`main` = `f3f00949f7243b2c7b91085f6c1f19254849515b`, 작업 트리 깨끗한 상태에서 README의 단계를 빌드까지 같은 runner 옵션(`--root .`)으로 실행했다.
버전: OpenJDK 21.0.11, Node 24.21.0, npm 11.19.0.

| 단계 | 명령 | 종료 코드 | 결과 (마지막 줄) |
|---|---|---|---|
| 설치 | `npm --prefix frontend install` | 0 | `up to date, audited 202 packages in 433ms` |
| 브라우저 설치 | `npx --prefix frontend playwright install chromium` | 0 | `Chrome Headless Shell 156.0.8078.4 … downloaded to <이 폴더>/.nexi-home/ms-playwright/…` |
| DB 준비 | (README: 따로 할 것 없음) | — | 실행할 명령 없음 |
| 빌드 | `make build` | 0 | `BUILD SUCCESS`, `✓ built in 611ms` |
| 작업 트리 | `git status --porcelain --untracked-files=all` | — | 빈 출력(README 단계가 추적 파일을 바꾸거나 무시되지 않은 파일을 남기지 않았다) |

## 앱

떠 있다 (2026-10-15 10:44, 이 폴더, README 실행 명령을 같은 runner 옵션으로).

| | 백엔드 | 프런트엔드 |
|---|---|---|
| 주소 | `http://127.0.0.1:8080` (API) | **`http://localhost:5173`** (브라우저로 여는 주소) |
| 띄운 프로세스 ID (프로세스 그룹) | 82968 | 83282 |
| 듣는 프로세스 ID | 83542 (82968의 자식) | 83316 (83282의 자식) |
| 명령 | `scripts/nexi-isolated.sh --root /Users/kibong/development/ax-rms --file DB_PATH=backend/data/app.db --set SERVER_PORT=8080 --set SERVER_ADDRESS=127.0.0.1 -- ./backend/mvnw -f backend/pom.xml spring-boot:run` | `scripts/nexi-isolated.sh --root /Users/kibong/development/ax-rms -- npm --prefix frontend run dev` |
| 응답 확인 | `/api/health` → `{"status":"UP"}` | 제목 `Workforce Planner`, 프록시 `/api/health` → `{"status":"UP"}` |

DB: 이 폴더에 전부터 있던 `backend/data/app.db`를 그대로 쓴다(README: 빈 DB일 때만 시드가 들어간다). 앱을 띄운 뒤 네 데모 계정 로그인이 모두 200이었다.
시드 상태에서 시작하려면 앱을 내리고 그 파일을 옮겨 둔 뒤 다시 띄운다(이 실행은 파일을 지우거나 바꾸지 않았다).

포트를 비우려고 PM이 open-webui 서비스(`com.openwebui.local`, 8080)를 `launchctl bootout`으로 내리고 vite 개발 서버(PID 97937, 5173)를 끝냈다.
open-webui는 `launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.openwebui.local.plist`로 되살린다.

## 수용된 태스크 (23)

모두 team 모드 수용 검사 6개를 통과했다(병합 PR 하나, 마지막 판정 `APPROVE`, 리뷰 뒤 리뷰 기록만 바뀜, squash 부모 = 판정의 base, 트리 = 리뷰한 head,
PM 병합).

| 이슈 | 제목 | 개발 | 병합 commit |
|---|---|---|---|
| #3 | Skeleton: Spring Boot·React·SQLite 구조와 make 명령 | azvfsxcd | `2daf5107` |
| #4 | Design system: BRIEF 기반 토큰·레이아웃·기본 컴포넌트와 make screenshots | mjpark-19 | `8ca8ce00` |
| #5 | 데이터 모델·저장소 계층·시드 데이터 | azvfsxcd | `55782e42` |
| #6 | 로그인·역할 권한 (API와 로그인 화면) | mjpark-19 | `62b74bc7` |
| #7 | 가용률 계산 엔진 | azvfsxcd | `8ee874a9` |
| #8 | 직원 API: 목록·검색·필터·상세·등록·수정·상태 변경 | azvfsxcd | `abb85650` |
| #9 | 프로젝트 API: 목록·필터·상세·등록·수정·필요 역량 | parkyevin | `2e69ff6c` |
| #10 | 배치 API: 배치·투입률 수정·해제와 검증 규칙 | MoonKibong | `a450c380` |
| #11 | 대시보드 API: 집계 지표 | daeboJang | `fab91f9a` |
| #12 | 간트 차트 컴포넌트 | parkyevin | `fe55fcaa` |
| #13 | 직원 목록 화면 | mjpark-19 | `a9ea60f3` |
| #15 | 프로젝트 목록 화면 | parkyevin | `d9178719` |
| #16 | 프로젝트 상세 화면과 목록의 등록 버튼 | parkyevin | `00e634df` |
| #17 | 프로젝트 인력 배치 화면 | parkyevin | `c86f5a3a` |
| #18 | 통합 대시보드 화면 | mjpark-19 | `5645d025` |
| #19 | §10 시연 흐름 E2E 검증 | mjpark-19 | `c2e54518` |
| #25 | 디자인 변경: BRIEF 3.6 간트 차트의 글자 배치 | parkyevin | `38137d31` |
| #28 | 내 정보 API: GET /api/me/employee | MoonKibong | `f66101bd` |
| #32 | 프로젝트 목록 인력 부족 표시 | parkyevin | `f29b7abb` |
| #34 | 프로젝트 등록·수정 폼 | mjpark-19 | `377512a2` |
| #38 | 직원 상세·내 정보 (읽기) | mjpark-19 | `ee044936` |
| #39 | 직원 등록·수정·상태 변경 (쓰기) | mjpark-19 | `69cbb7fe` |
| #50 | 외부 commit 검토: NEXI 이전·설정 commit 5개 | MoonKibong | `f3f00949` |

## 수용되지 않고 닫힌 이슈

| 이슈 | 제목 | 까닭 |
|---|---|---|
| #14 | 직원 상세·등록·수정 화면 (내 정보 포함) | 나눔: #38(읽기)·#39(쓰기)로 나누어 닫음(`not planned`). 저장 `origin/t14` `ba03d873e30fce2812d3bc0db6f4d7cf16608532`, 참고용 |

## `main` 기록

`git rev-list --first-parent origin/main`의 commit 30개: 수용된 태스크의 병합 commit 23, `req` 브랜치에서 PM이 병합한 요구사항 commit 2
(`65a9fa02` 요구사항 승인 #2, `ee1500bd` REQUEST.md 표 구분선 #44), #50이 검토하고 그대로 두기로 한 NEXI 이전·설정 commit 5
(`82973c38`, `1f3ca6f1`, `0d8b66fe`, `a4f5c995`, `bb515a53`). 해결되지 않은 commit 없음.

## 진행 중 정한 일 (PM 결정)

- **D5 "직원별 투입률", "부서별 평균 투입률"은 가용률로 보인다.** #11 API가 현재 가용률과 부서 평균 가용률을 돌려주고 화면은 계산하지 않으므로(D36),
  대시보드의 두 목록 제목을 "직원별 가용률", "부서별 평균 가용률"로 했다(#18 계약 승인, 이슈 #18 댓글 2026-10-14). API에 투입률을 더하지 않았다.
- **#34: 1024px 미만에서 프로젝트 등록·수정 주소는 돌려보내지 않고 데스크톱 이용 안내를 보인다**(#39 직원 폼과 같다, 이슈 #34 댓글 2026-10-14). D29의
  "관리 기능은 모바일에서 숨김"을 이렇게 따른다.
- **#19: `make screenshots`는 모든 실행을 실행별 임시 DB(`--fresh-db`)로 돌린다**(이슈 #19 댓글). 공유 e2e DB에 쓰지 않으면서 배치 전후 화면을 찍기
  위해서다. #19 기준 9의 Playwright 합계는 #32 병합 뒤의 새 base에서 다시 세어 비교했다(PM 해석).
- **D41(기록자 ≠ PR 작성자)의 예외**: #28, #10, #50은 PM이 직접 개발했고 리뷰는 Codex가 했으며, 판정 기록과 병합은 PM이 확인하고 했다.
- **#11 판정 기록**: 판정 2행의 `T\#11` 백슬래시만 PM 지시로 빼고 기록했다(이슈 #11 댓글).
- **#50**: NEXI 이전·설정 commit 5개를 검토해 모두 그대로 두기로 했다(`docs/contracts/T50.md`, `docs/evidence/T50.md`).

## 고객 확인이 남은 결정

REQ-CONTEXT "고객 확인이 남은 결정": 없음. "답이 없는 질문": 없음.
수행사가 고객 없이 정한 결정(PM 확인): D11–D32, D33–D38의 수준과 확인 방법, D39의 버전·도구, D40의 로컬 시연. 위 "진행 중 정한 일"의 D5 표시
방식도 고객이 확인할 만하다.

## 로그인 계정 (시드, D31)

빈 DB로 처음 실행하면 들어간다. 로그인 화면 `/login`.

| 아이디 | 비밀번호 | 역할 |
|---|---|---|
| `hr.manager` | `HrManager!1` | 직원, 인력 관리자 |
| `project.manager` | `ProjectManager!1` | 직원, 프로젝트 관리자 |
| `employee.demo` | `Employee!1` | 직원 |
| `dual.manager` | `DualManager!1` | 직원, 인력 관리자, 프로젝트 관리자(겸임) |

## 둘러보기 (사람이 확인)

떠 있는 앱 `http://localhost:5173`에서 아래를 확인하고 결과 칸을 채운다(위 "앱" 절). 결과는 `확인함`, `이상 있음: <무엇>`,
`확인 안 함` 가운데 하나다. 결과는 사람만 정한다.

| # | 화면·기능 (REQ-CONTEXT) | 계정 | 너비 | 확인할 것 | 결과 |
|---|---|---|---|---|---|
| 1 | 로그인 (D16) | 네 계정, 틀린 비밀번호 | 1280, 360 | 관리자는 `/`(대시보드), `employee.demo`는 `/me`로 간다. 틀린 비밀번호는 오류 문장 | 확인함 |
| 2 | 통합 대시보드 (D5, D20, D21, D23) | `project.manager` | 1280, 360 | 타일 다섯 개와 목록 네 개(확인 필요 배치, 인력 부족 프로젝트, 직원별 가용률, 부서별 평균 가용률), 각 항목에서 직원·프로젝트로 이동 | 확인함 |
| 3 | 직원 목록 (D2) | `hr.manager` | 1280, 360 | 이름 검색, 부서·기술·투입 상태·가용률 필터, 데스크톱에 "직원 등록" 버튼 | 확인함 |
| 4 | 직원 상세 (D2, D4) | `project.manager` | 1280, 360 | 기본 정보, 기술·숙련도, 참여 프로젝트·투입률, 현재 가용률, 배치 간트 | 확인함 |
| 5 | 직원 등록·수정·상태 변경 (D9, D29) | `hr.manager` | 1280 | 등록·수정 폼, 입력 오류 메시지 위치, 상태 변경 대화상자(투입 불가 사유·종료 예정일) | 확인함 |
| 6 | 직원 관리 기능의 모바일 처리 (D29) | `hr.manager` | 360 | 등록·수정·상태 변경 버튼이 없고 폼 주소는 데스크톱 이용 안내 | 확인함 |
| 7 | 프로젝트 목록 (D3, D20) | `project.manager` | 1280, 360 | 상태 필터, 필요·배치 인원, "인력 부족" 열 | 확인함 |
| 8 | 프로젝트 상세 (D3, D4) | `project.manager` | 1280, 360 | 기간·상태·필요 역량, 배치 인력과 투입률, "인력 배치" 버튼 | 확인함 |
| 9 | 프로젝트 등록·수정 (D3, D22, D30) | `project.manager` | 1280 | 필요 역량 줄 추가·삭제, 기간을 줄여 배정이 밖으로 나가면 원인 메시지 | 확인함 |
| 10 | 프로젝트 관리 기능의 모바일 처리 (D29) | `project.manager` | 360 | 등록·수정 버튼이 없고 폼 주소는 데스크톱 이용 안내 | 확인함 |
| 11 | 인력 배치 (D7, D8, D14, D18, D27, D28) | `project.manager` | 1280, 360 | 기간 선택, 후보의 기간 가용률, 간트, 5% 단위 배치, 100% 초과·투입 불가 차단 메시지, 수정, 해제 확인 대화상자 | 확인함 |
| 12 | §10 시연 흐름 (D10, D36) | `project.manager` | 1280, 360 | 조회 → 선택 → 배치 → 대시보드·직원·프로젝트 갱신 → 100% 초과 차단 → 투입 불가 차단 → 해제 후 복구 | 확인함 |
| 13 | 인력 관리자의 배치 권한 (D9) | `hr.manager` | 1280 | 프로젝트 상세에 "인력 배치"가 없고 배치 주소는 상세로 돌아간다 | 확인함 |
| 14 | 직원 역할만 (D25) | `employee.demo` | 1280, 360 | `/me`(내 정보)만 보이고 다른 주소는 `/me`로 간다 | 확인함 |
| 15 | 겸임 (D9) | `dual.manager` | 1280 | 직원 관리와 프로젝트·배치 관리가 모두 된다 | 확인함 |
| 16 | 가로 스크롤 없음 (D34, BRIEF) | 아무 관리자 | 360 | 위 화면들에서 가로로 넘치지 않는다 | 확인함 |
