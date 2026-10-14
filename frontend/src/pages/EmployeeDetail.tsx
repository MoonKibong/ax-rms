import { useEffect, useState } from 'react'
import type { EmployeeDetail as Detail, ProficiencyLevel } from '../api/employees'
import type { ProjectStatus } from '../api/projects'
import Badge from '../components/Badge'
import DataTable, { type Column } from '../components/DataTable'
import Gantt from '../components/Gantt'
import type { GanttAssignment } from '../components/gantt/model'
import Spinner from '../components/Spinner'
import StateMessage from '../components/StateMessage'
import './EmployeeDetail.css'

// T#38, BRIEF §6.4 (D2, D15, D21, D24, D36): one employee's detail as the API returns it, used by the detail screen
// (/employees/:id) and by 내 정보 (/me). The screen computes nothing: availability, 확인 필요 and the server's today come
// from the answer.
type LoadState = { phase: 'loading' } | { phase: 'error'; message?: string } | { phase: 'ready'; employee: Detail }

type AssignmentRow = { key: string; projectName: string; period: string; allocationPercent: number }

const NOT_FOUND = '직원을 찾을 수 없습니다.'

const LEVELS: Record<ProficiencyLevel, string> = { BEGINNER: '초급', INTERMEDIATE: '중급', ADVANCED: '고급' }

const GANTT_STATUS: Record<ProjectStatus, GanttAssignment['projectStatus']> = {
  PLANNED: '계획',
  IN_PROGRESS: '진행 중',
  DONE: '완료',
  ON_HOLD: '보류',
}

const COLUMNS: Column<AssignmentRow>[] = [
  { key: 'projectName', header: '프로젝트' },
  { key: 'period', header: '기간' },
  { key: 'allocationPercent', header: '투입률', align: 'end', render: (row) => `${row.allocationPercent}%` },
]

const NONE = <span className="employee-detail__none">—</span>

class LoadError extends Error {}

async function loadDetail(url: string, signal: AbortSignal): Promise<Detail> {
  const response = await fetch(url, { signal })
  if (!response.ok) {
    // Read the error body too: an unread body keeps the request open in the browser. Its message is shown (D33).
    const body: unknown = await response.json().catch(() => null)
    const message =
      body !== null && typeof body === 'object' && 'message' in body && typeof body.message === 'string'
        ? body.message
        : undefined
    throw new LoadError(message)
  }
  return (await response.json()) as Detail
}

function EmployeeDetailView({ employee, headingLevel }: { employee: Detail; headingLevel: 1 | 2 }) {
  const Name = headingLevel === 1 ? 'h1' : 'h2'
  const info: Array<[string, string | null]> = [
    ['부서', employee.departmentName],
    ['직무', employee.jobTitle],
    ['경력', `${employee.careerYears}년`],
    ['투입 불가 사유', employee.unavailableReason],
    ['종료 예정일', employee.unavailableUntil],
  ]
  const bars: GanttAssignment[] = employee.assignments.map((assignment) => ({
    id: `${assignment.projectId}-${assignment.startDate}`,
    projectName: assignment.projectName,
    projectStatus: GANTT_STATUS[assignment.projectStatus],
    start: assignment.startDate,
    end: assignment.endDate,
    rate: assignment.allocationPercent,
  }))
  const rows: AssignmentRow[] = employee.assignments.map((assignment) => ({
    key: `${assignment.projectId}-${assignment.startDate}`,
    projectName: assignment.projectName,
    period: `${assignment.startDate} ~ ${assignment.endDate}`,
    allocationPercent: assignment.allocationPercent,
  }))

  return (
    <div className="employee-detail">
      <div className="employee-detail__head">
        <Name className="employee-detail__name" data-testid="employee-name">
          {employee.name}
        </Name>
        <div className="employee-detail__status">
          <Badge status={employee.availabilityStatus} />
          {employee.needsReview ? <Badge status="NEEDS_REVIEW" /> : null}
          <p className="employee-detail__availability">
            <span>현재 가용률</span>{' '}
            <span className="employee-detail__availability-value" data-testid="current-availability">
              {employee.currentAvailability}%
            </span>
          </p>
        </div>
      </div>

      <section className="employee-detail__section">
        <h2 className="employee-detail__section-title">기본 정보</h2>
        <dl className="employee-detail__info">
          {info.map(([label, value]) => (
            <div key={label} className="employee-detail__row">
              <dt>{label}</dt>
              <dd>{value ?? NONE}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="employee-detail__section">
        <h2 className="employee-detail__section-title">기술</h2>
        {employee.skills.length > 0 ? (
          <ul className="employee-detail__skills">
            {employee.skills.map((skill) => (
              <li key={skill.skillName}>{`${skill.skillName} · ${LEVELS[skill.proficiencyLevel]}`}</li>
            ))}
          </ul>
        ) : (
          <p>{NONE}</p>
        )}
      </section>

      <section className="employee-detail__section">
        <h2 className="employee-detail__section-title">배치 현황</h2>
        <Gantt assignments={bars} today={employee.today} />
        {rows.length > 0 ? <DataTable columns={COLUMNS} rows={rows} rowKey={(row) => row.key} empty={null} /> : null}
      </section>
    </div>
  )
}

type EmployeeDetailLoaderProps = {
  // The API address of the detail, or null when the page address names no employee (then nothing is asked).
  url: string | null
  // 1 on the detail screen; 2 on 내 정보, whose title is "내 정보" (T#6).
  headingLevel: 1 | 2
  // 내 정보 already knows whose page it is from the login (T#6 showed that name there): it stays as the heading while
  // the detail is loading or could not be loaded. Once the detail has come, every value is the API's.
  pendingName?: string
}

// One request at a time counts: a new address (or a retry) cancels the one before, and an answer that comes after
// that is ignored, so the screen always shows the last address.
function EmployeeDetailLoader({ url, headingLevel, pendingName }: EmployeeDetailLoaderProps) {
  const [state, setState] = useState<LoadState>({ phase: 'loading' })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (url === null) {
      return undefined
    }
    const controller = new AbortController()
    setState({ phase: 'loading' })
    loadDetail(url, controller.signal).then(
      (employee) => {
        if (!controller.signal.aborted) {
          setState({ phase: 'ready', employee })
        }
      },
      (error: unknown) => {
        if (!controller.signal.aborted) {
          setState({ phase: 'error', message: error instanceof LoadError ? error.message || undefined : undefined })
        }
      },
    )
    return () => controller.abort()
  }, [url, attempt])

  if (url === null) {
    return <StateMessage kind="error" description={NOT_FOUND} />
  }
  if (state.phase === 'ready') {
    return <EmployeeDetailView employee={state.employee} headingLevel={headingLevel} />
  }
  const Name = headingLevel === 1 ? 'h1' : 'h2'
  return (
    <div className="employee-detail">
      {pendingName ? <Name className="employee-detail__name">{pendingName}</Name> : null}
      {state.phase === 'loading' ? (
        <div className="employee-detail__loading" aria-busy="true">
          <Spinner />
          <p className="employee-detail__loading-text">불러오는 중…</p>
        </div>
      ) : (
        <StateMessage kind="error" description={state.message} onRetry={() => setAttempt((count) => count + 1)} />
      )}
    </div>
  )
}

export default EmployeeDetailLoader
