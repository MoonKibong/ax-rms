# Requirement Context (ax-rms)

This document consolidates the original requirements and the team's decisions to serve as the single source of truth for implementation.

## 1. Core Decisions (From Team Answers)

### 1.1 Staff & Competencies
- **Skill Levels:** Divided into **3 stages**.
- **Experience:** Managed as **Total Experience** (sum of years).
- **Roles:** Users can hold **multiple roles simultaneously**.

### 1.2 Allocation & Availability Logic
- **Calculation Granularity:** Performed on a **Daily basis**.
- **Input Precision:** Allocation percentage (%) is entered in **5% increments**.
- **Visualization:** Overlapping assignments are visualized using a **Gantt Chart**.
- **Verification Flow:** For staff marked as 'Unavailable' but with existing assignments, the **Human Resource Manager** is responsible for verification and resolution.

### 1.3 Project Management
- **Project Status:** \[Planned, In Progress, Completed, On Hold\].
- **Shortage Criteria:**
    - **Manpower Shortage:** Assigned headcount < Required headcount.
    - **Skill Shortage:** Absence of staff possessing a specific mandatory skill.

### 1.4 UX & Platform
- **Mobile Scope:** All features provided on mobile, **except Administrative functions**.
- **Access Control:** Role-based views are determined **at login**.

### 1.5 Technical Implementation
- **Seed Data Volume:** 3 Departments, 20 Employees, 5 Projects.
- **Database Strategy:** Currently SQLite due to low concurrency. Architecture must ensure **DBMS independence** (Abstraction Layer/Repository Pattern) for future migration.

## 2. Base Requirements Reference
Refer to `docs/requirements/REQUEST.md` for the full functional specifications.
