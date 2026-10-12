# Workforce Planner Development Backlog

## 📅 Development Timeline & Sequence
Priority: BE API Provision $\rightarrow$ FE Integration

| ID | Task Name | Assignee | Priority | Dependency | Description |
| :--- | :--- | :--- | :---: | :--- | :--- |
| **PHASE 1: Foundation** | | | | | |
| T1.1 | DB Schema Design & Repository Layer | 김재민 | P0 | - | SQLite schema & Repository pattern for DBMS independence |
| T1.2 | Auth & Role-based Routing | 김재민, 박미정 | P1 | T1.1 | Login role assignment & access control (Admin/Manager/Staff) |
| T1.3 | Base Code & Common Components | 박미정, 박예빈 | P1 | - | React + TS setup & common UI components |
| **PHASE 2: Core Engine** | | | | | |
| T2.1 | **[Core]** Daily Availability Engine | 김재민 | P0 | T1.1 | Daily allocation summation, 100% overflow check, 5% precision |
| T2.2 | Staff Management API & CRUD | 김재민 | P1 | T1.1 | Staff reg, mod, view & availability status mgmt |
| T2.3 | Project Management API & CRUD | 김재민 | P1 | T1.1 | Project info, required skills, status mgmt |
| **PHASE 3: Feature Integration** | | | | | |
| T3.1 | Staff Mgmt Screen & Filter UI | 박미정 | P2 | T2.2 | Staff list, details, skill/status filtering |
| T3.2 | Project Mgmt Screen & Status UI | 박예빈 | P2 | T2.3 | Project list, status filters, manpower status |
| T3.3 | Manpower Allocation API (Assign/Release)| 김재민 | P0 | T2.1 | Allocation storage/cancellation w/ validation & error msgs |
| T3.4 | Allocation Execution UI & Feedback | 박예빈 | P0 | T3.3 | Input period/ratio, real-time validation feedback |
| **PHASE 4: Insight & Polish** | | | | | |
| T4.1 | Company-wide Availability API | 김재민 | P2 | T2.1 | Dashboard aggregates: overall avail & project shortages |
| T4.2 | Main Dashboard & Avail Visualization | 박미정 | P2 | T4.1 | Overview board, quick-view, alerts |
| T4.3 | **[Feature]** Allocation Gantt Chart | 박예빈 | P1 | T3.4 | Daily interval visualization & overlap highlighting |
| T4.4 | Demo Seed Data Scripts | 김재민 | P3 | T1.1 | Sample data: 3 Depts, 20 Staff, 5 Projects |
| **PHASE 5: QA & Delivery** | | | | | |
| T5.1 | Business Rule Auto-Tests | 장광희, 김재민 | P0 | ALL | Verify 100% cap, Unavailable-staff blocking, etc. |
| T5.2 | Scenario E2E Testing & Bug Fixes | ALL | P0 | ALL | Final demo based on Success Criteria (1-7) |

## 🛠️ Assignment Summary
- **김재민 (BE)**: DB $\rightarrow$ Engine $\rightarrow$ APIs $\rightarrow$ Seed Data
- **박미정 (FE 1)**: Infrastructure $\rightarrow$ Staff Mgmt $\rightarrow$ Dashboard
- **박예빈 (FE 2)**: Infrastructure $\rightarrow$ Project Mgmt $\rightarrow$ Allocation UI $\rightarrow$ Gantt Chart
- **장광희 (Reviewer)**: API Specs $\rightarrow$ Logic Audit $\rightarrow$ Test Case Design
- **문기봉 (PM/FE Reviewer)**: Req alignment $\rightarrow$ Priority $\rightarrow$ UX/UI Approval

## 🚩 Critical Path
T1.1 $\rightarrow$ T2.1 $\rightarrow$ T3.3 $\rightarrow$ T3.4 $\rightarrow$ T5.1
