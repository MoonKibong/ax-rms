# Requirements Analysis Questions (ax-rms)

This document contains ambiguities and points requiring clarification identified during the `nexi-requirements analyze` phase. Answers are required to finalize the PRD and Backlog.

## 1. Staff & Competency (인력 및 역량)
- **Q-1.1 [Skill Levels]:** 기술 숙련도는 몇 단계로 구분하시나요? (예: 1~5단계, 혹은 Junior/Mid/Senior 등) 정량적 수치가 필요합니다.
- **Q-1.2 [Experience]:** '경력' 항목은 전체 총 경력(년 수)만을 의미하나요, 아니면 각 기술 스택별 세부 경력을 각각 관리해야 하나요?
- **Q-1.3 [Role Assignment]:** 한 사용자가 여러 역할을 동시에 가질 수 있나요? (예: 프로젝트 관리자이면서 동시에 특정 프로젝트의 팀원인 경우)

## 2. Allocation & Availability Logic (배치 및 가용률 로직)
- **Q-2.1 [Granularity]:** 가용률 계산의 시간 단위(Granularity)는 무엇인가요? (예: 일 단위, 월 단위). 부분적으로 기간이 겹치는 경우(예: 프로젝트 A는 1~15일, 프로젝트 B는 10~20일)의 합산 방식에 대한 정의가 필요합니다.
- **Q-2.2 [Input Unit]:** 투입률(%) 입력 시 최소 단위는 얼마인가요? (예: 1% 단위, 5% 단위, 혹은 10% 단위)
- **Q-2.3 [Overlap Visualization]:** 일부 기간만 겹치는 다수의 배정이 있을 때, 이를 사용자에게 어떤 형태로 시각화하여 보여주길 원하시나요? (예: Gantt Chart 형태, 리스트 형태)
- **Q-2.4 [Confirmation Needed Status]:** '투입 불가'로 변경되었으나 기존 배정이 남은 직원을 '확인 필요'로 표시한다고 하셨습니다. 이때 '확인'의 주체는 누구이며, 확인 후 어떤 액션(배치 해제 또는 상태 변경)이 일어나야 하나요?

## 3. Project Management (프로젝트 관리)
- **Q-3.1 [Project Status]:** 프로젝트 상태에 들어갈 구체적인 값들은 무엇인가요? (예: 준비중, 진행중, 완료, 보류 등)
- **Q-3.2 [Manpower Shortage]:** 대시보드에서 '인력이 부족한 프로젝트'를 판별하는 명확한 기준은 무엇인가요? (예: 필요 인원 < 배치 인원, 혹은 특정 필수 기술 보유자 부재)

## 4. User Experience & Interface (UX/UI)
- **Q-4.1 [Mobile Scope]:** '핵심 흐름'의 범위가 어디까지인가요? 모바일에서도 '인력 배치'와 '등록/수정' 기능이 모두 포함되어야 하는지, 아니면 '조회 및 대시보드' 중심인지 명확히 해주십시오.
- **Q-4.2 [User Switching]:** 역할별(관리자/직원) 화면 진입 및 권한 전환은 어떤 방식으로 제공되길 원하시나요? (예: 로그인 시 역할 자동 부여, 혹은 관리자 메뉴 별도 제공)

## 5. Technical & Data (기술 및 데이터)
- **Q-5.1 [Seed Data]:** 데모용 시드 데이터의 규모는 어느 정도여야 하나요? (예: 부서 3개, 직원 20명, 프로젝트 5개 수준)
- **Q-5.2 [Concurrency]:** SQLite를 사용함에 따라 동시 쓰기 요청 시 Lock이 발생할 수 있습니다. 동시 접속자가 매우 적을 것으로 예상하시나요, 아니면 간단한 큐잉/재시도 로직이 필요할까요?

---
**Next Step:** Team provides answers $\rightarrow$ `nexi-requirements answers` $\rightarrow$ `nexi-requirements decide`.
