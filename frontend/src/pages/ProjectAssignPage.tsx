import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, Navigate, useParams } from 'react-router'
import { apiFetch } from '../api/client'
import { sendAssignment, type AssignmentCreate, type AssignmentModify, type Candidate, type FailureSpot } from '../api/assignments'
import type { EmployeeDetail, EmployeeListItem } from '../api/employees'
import type { AssignedEmployee, ProjectDetail, ProjectStatus } from '../api/projects'
import { useAuth } from '../auth/AuthContext'
import AppShell from '../components/AppShell'
import Button from '../components/Button'
import ButtonLink from '../components/ButtonLink'
import DataTable, { type Column } from '../components/DataTable'
import Gantt from '../components/Gantt'
import type { GanttAssignment } from '../components/gantt/model'
import Period from '../components/Period'
import StateMessage from '../components/StateMessage'
import TextField from '../components/TextField'
import { WarningIcon } from '../components/icons'
import AssignCandidates, { type CandidatesState } from './AssignCandidates'
import ReleaseDialog from './AssignmentRelease'
import './pages.css'
import './ProjectAssignPage.css'

// T#17, BRIEF 6.7 (D8, D14, D15, D27, D28, D33, D36): choose a period, look at the candidates' availability for it, pick one,
// see the schedule, assign with a percent in steps of 5, change or release the current assignments. The screen shows what
// the API answers and asks again after every save; it computes no availability.
const GANTT_STATUS: Record<ProjectStatus, GanttAssignment['projectStatus']> = {
  PLANNED: '계획',
  IN_PROGRESS: '진행 중',
  DONE: '완료',
  ON_HOLD: '보류',
}

// T#53: one assignment covers at most 366 days, both dates counted (the server's ASSIGNMENT_PERIOD_TOO_LONG).
const MAX_PERIOD_DAYS = 366
const PERIOD_TOO_LONG = '배치 기간은 최대 366일입니다.'
const DAY_MS = 24 * 60 * 60 * 1000

function periodDays(start: string, end: string): number {
  return Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / DAY_MS) + 1
}

// The project's end date, or the last day of the first 366 days when the project is longer.
function firstDays(start: string, end: string): string {
  if (periodDays(start, end) <= MAX_PERIOD_DAYS) return end
  return new Date(Date.parse(`${start}T00:00:00Z`) + (MAX_PERIOD_DAYS - 1) * DAY_MS).toISOString().slice(0, 10)
}

const RELOAD_FAILED = '프로젝트를 다시 불러오지 못했습니다.'
const PERCENT_RULE = '투입률은 5~100의 5 단위로 입력하세요.'

type ProjectState = { phase: 'loading' } | { phase: 'error' } | { phase: 'missing' } | { phase: 'ready'; project: ProjectDetail }
type ScheduleState = { phase: 'idle' } | { phase: 'loading' } | { phase: 'error' } | { phase: 'ready'; employee: EmployeeDetail }
type Editing = { assignmentId: number; employeeId: number; employeeName: string; start: string; end: string; percent: number }
type Errors = Partial<Record<FailureSpot, string>>

async function getJson<T>(url: string, signal: AbortSignal): Promise<T> {
  const response = await apiFetch(url, { signal })
  if (!response.ok) {
    // Read the error body too: an unread body keeps the request open in the browser.
    await response.text().catch(() => '')
    throw new Error(`status ${response.status}`)
  }
  return (await response.json()) as T
}

// 5 to 100 in steps of 5 (D14); anything else is stopped before a request is sent.
function readPercent(text: string): number | null {
  const value = Number(text)
  return text.trim() !== '' && Number.isInteger(value) && value >= 5 && value <= 100 && value % 5 === 0 ? value : null
}

function ProjectAssignPage({ id }: { id: number }) {
  const [projectState, setProjectState] = useState<ProjectState>({ phase: 'loading' })
  const [projectAttempt, setProjectAttempt] = useState(0)
  // Raised after every save: project, candidates and the schedule are asked for again (D36).
  const [refresh, setRefresh] = useState(0)
  const hasProject = useRef(false)
  // T#58: the project could not be asked for again after the page had one. The page and the form stay.
  const [reloadFailed, setReloadFailed] = useState(false)
  // Raised when a save or a check refuses an input; the focus then goes to the first input that says why.
  const [focusAsk, setFocusAsk] = useState(0)
  const pageRef = useRef<HTMLDivElement>(null)

  const [period, setPeriod] = useState<{ start: string; end: string } | null>(null)
  const [candidates, setCandidates] = useState<CandidatesState>({ phase: 'loading', rows: null })
  const [candidatesAttempt, setCandidatesAttempt] = useState(0)
  const [employees, setEmployees] = useState<EmployeeListItem[] | null>(null)
  const [employeesFailed, setEmployeesFailed] = useState(false)
  const [employeesAttempt, setEmployeesAttempt] = useState(0)

  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [schedule, setSchedule] = useState<ScheduleState>({ phase: 'idle' })
  const [scheduleAttempt, setScheduleAttempt] = useState(0)

  const [percentText, setPercentText] = useState('')
  const [editing, setEditing] = useState<Editing | null>(null)
  const [errors, setErrors] = useState<Errors>({})
  const [saving, setSaving] = useState(false)
  const [releasing, setReleasing] = useState<AssignedEmployee | null>(null)
  // One request at a time, however often 배치 is pressed while it is under way.
  const inFlight = useRef(false)

  const project = projectState.phase === 'ready' ? projectState.project : null
  const start = period?.start ?? project?.startDate ?? ''
  const end = period?.end ?? (project ? firstDays(project.startDate, project.endDate) : '')
  const periodTooLong = start !== '' && end !== '' && start <= end && periodDays(start, end) > MAX_PERIOD_DAYS
  const periodAsked = project !== null && start !== '' && end !== '' && start <= end && !periodTooLong

  useEffect(() => {
    const controller = new AbortController()
    if (!hasProject.current) {
      setProjectState({ phase: 'loading' })
    }
    apiFetch(`/api/projects/${id}`, { signal: controller.signal })
      .then(async (response) => {
        if (response.status === 404) {
          await response.text().catch(() => '')
          return null
        }
        if (!response.ok) {
          await response.text().catch(() => '')
          throw new Error(`status ${response.status}`)
        }
        return (await response.json()) as ProjectDetail
      })
      .then((found) => {
        if (controller.signal.aborted) return
        hasProject.current = found !== null
        setReloadFailed(false)
        setProjectState(found ? { phase: 'ready', project: found } : { phase: 'missing' })
      })
      .catch(() => {
        if (controller.signal.aborted) return
        if (hasProject.current) {
          // The last project stays on the screen with its form; only the project can be asked for again.
          setReloadFailed(true)
          return
        }
        setProjectState({ phase: 'error' })
      })
    return () => controller.abort()
  }, [id, projectAttempt, refresh])

  useEffect(() => {
    const controller = new AbortController()
    getJson<EmployeeListItem[]>('/api/employees', controller.signal)
      .then((list) => {
        if (!controller.signal.aborted) {
          setEmployees(list)
          setEmployeesFailed(false)
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) setEmployeesFailed(true)
      })
    return () => controller.abort()
  }, [employeesAttempt])

  useEffect(() => {
    if (focusAsk > 0) {
      pageRef.current?.querySelector<HTMLElement>('input[aria-invalid="true"]')?.focus()
    }
  }, [focusAsk])

  // A new period (or a save, or a retry) cancels the request before, and an answer that comes after that is ignored.
  useEffect(() => {
    if (!periodAsked) return undefined
    const controller = new AbortController()
    setCandidates((before) => ({ phase: 'loading', rows: before.rows }))
    getJson<Candidate[]>(`/api/assignments/candidates?projectId=${id}&startDate=${start}&endDate=${end}`, controller.signal)
      .then((rows) => {
        if (!controller.signal.aborted) setCandidates({ phase: 'ready', rows })
      })
      .catch(() => {
        if (!controller.signal.aborted) setCandidates((before) => ({ phase: 'error', rows: before.rows }))
      })
    return () => controller.abort()
  }, [id, periodAsked, start, end, refresh, candidatesAttempt])

  useEffect(() => {
    if (selectedId === null) {
      setSchedule({ phase: 'idle' })
      return undefined
    }
    const controller = new AbortController()
    setSchedule((before) => (before.phase === 'ready' && before.employee.id === selectedId ? before : { phase: 'loading' }))
    getJson<EmployeeDetail>(`/api/employees/${selectedId}`, controller.signal)
      .then((employee) => {
        if (!controller.signal.aborted) setSchedule({ phase: 'ready', employee })
      })
      .catch(() => {
        if (!controller.signal.aborted) setSchedule({ phase: 'error' })
      })
    return () => controller.abort()
  }, [selectedId, refresh, scheduleAttempt])

  function clearError(spot: FailureSpot) {
    setErrors((before) => {
      if (before[spot] === undefined) return before
      const rest = { ...before }
      delete rest[spot]
      return rest
    })
  }

  function endEditing() {
    setEditing(null)
    setPercentText('')
    setPeriod(null)
    setErrors({})
  }

  function startEditing(row: AssignedEmployee) {
    setEditing({
      assignmentId: row.assignmentId,
      employeeId: row.employeeId,
      employeeName: row.employeeName,
      start: row.startDate,
      end: row.endDate,
      percent: row.allocationPercent,
    })
    setSelectedId(row.employeeId)
    setPeriod({ start: row.startDate, end: row.endDate })
    setPercentText(String(row.allocationPercent))
    setErrors({})
  }

  // The input checks of the contract: a period of two dates in order and a percent of 5 to 100 in steps of 5.
  function checkInput(): { percent: number } | null {
    const found: Errors = {}
    if (start === '' || end === '') {
      found.period = '시작일과 종료일을 입력하세요.'
    } else if (start > end) {
      found.period = '시작일은 종료일보다 늦을 수 없습니다.'
    } else if (periodTooLong) {
      found.period = PERIOD_TOO_LONG
    }
    const percent = readPercent(percentText)
    if (percent === null) {
      found.percent = PERCENT_RULE
    }
    setErrors(found)
    if (found.period || found.percent) setFocusAsk((count) => count + 1)
    return percent === null || found.period ? null : { percent }
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (inFlight.current || project === null) return
    const input = checkInput()
    if (input === null) return
    let result
    if (editing) {
      const changed: AssignmentModify = {}
      if (input.percent !== editing.percent) changed.allocationPercent = input.percent
      if (start !== editing.start) changed.startDate = start
      if (end !== editing.end) changed.endDate = end
      if (Object.keys(changed).length === 0) {
        endEditing()
        return
      }
      inFlight.current = true
      setSaving(true)
      result = await sendAssignment('PATCH', `/api/assignments/${editing.assignmentId}`, changed)
    } else if (selectedId !== null) {
      const body: AssignmentCreate = { employeeId: selectedId, projectId: project.id, startDate: start, endDate: end, allocationPercent: input.percent }
      inFlight.current = true
      setSaving(true)
      result = await sendAssignment('POST', '/api/assignments', body)
    } else {
      return
    }
    inFlight.current = false
    setSaving(false)
    if (result.ok) {
      if (editing) {
        endEditing()
      } else {
        setPercentText('')
        setErrors({})
      }
      setRefresh((count) => count + 1)
      return
    }
    setErrors({ [result.failure.spot]: result.failure.message })
    if (result.failure.spot !== 'form') setFocusAsk((count) => count + 1)
  }

  let content
  if (projectState.phase === 'loading') {
    content = <p className="assign__loading">불러오는 중…</p>
  } else if (projectState.phase === 'error') {
    content = <StateMessage kind="error" onRetry={() => setProjectAttempt((count) => count + 1)} />
  } else if (projectState.phase === 'missing') {
    content = (
      <div className="assign__missing">
        <StateMessage kind="empty" title="프로젝트를 찾을 수 없습니다" description="주소를 확인하거나 목록에서 다시 고르세요." />
        <ButtonLink to="/projects" variant="secondary">
          프로젝트 목록
        </ButtonLink>
      </div>
    )
  } else {
    const shown = projectState.project
    const assignedColumns: Column<AssignedEmployee>[] = [
      {
        key: 'employeeName',
        header: '직원',
        render: (row) => (
          <Link className="assign__link" to={`/employees/${row.employeeId}`}>
            {row.employeeName}
          </Link>
        ),
      },
      { key: 'startDate', header: '기간', render: (row) => <Period startDate={row.startDate} endDate={row.endDate} /> },
      { key: 'allocationPercent', header: '투입률', align: 'end', render: (row) => `${row.allocationPercent}%` },
      {
        key: 'assignmentId',
        header: '작업',
        render: (row) => (
          <span className="assign__row-actions">
            <Button variant="secondary" onClick={() => startEditing(row)}>
              수정
            </Button>
            <Button variant="danger" onClick={() => setReleasing(row)}>
              해제
            </Button>
          </span>
        ),
      },
    ]
    const bars: GanttAssignment[] =
      schedule.phase === 'ready'
        ? schedule.employee.assignments.map((assignment) => ({
            id: `${assignment.projectId}-${assignment.startDate}`,
            projectName: assignment.projectName,
            projectStatus: GANTT_STATUS[assignment.projectStatus],
            start: assignment.startDate,
            end: assignment.endDate,
            rate: assignment.allocationPercent,
          }))
        : []
    const candidateState: CandidatesState = employeesFailed ? { phase: 'error', rows: candidates.rows } : candidates

    content = (
      <>
        {reloadFailed ? (
          <div className="assign__reload">
            <p className="field__error" role="alert">
              <WarningIcon size={16} />
              {RELOAD_FAILED}
            </p>
            <Button variant="secondary" onClick={() => setProjectAttempt((count) => count + 1)}>
              다시 불러오기
            </Button>
          </div>
        ) : null}
        <div className="assign__summary">
          <h1 className="page__title">{shown.name}</h1>
          <p className="assign__period">
            {shown.startDate}
            {' ~ '}
            {shown.endDate}
          </p>
          <Link className="assign__link" to={`/projects/${shown.id}`}>
            프로젝트 상세
          </Link>
        </div>

        <fieldset className="assign__range">
          <legend className="assign__legend">배치 기간</legend>
          <div className="assign__range-fields">
            <TextField
              label="시작일"
              type="date"
              value={start}
              onChange={(event) => {
                setPeriod({ start: event.target.value, end })
                clearError('period')
              }}
            />
            <TextField
              label="종료일"
              type="date"
              value={end}
              error={errors.period ?? (periodTooLong ? PERIOD_TOO_LONG : undefined)}
              onChange={(event) => {
                setPeriod({ start, end: event.target.value })
                clearError('period')
              }}
            />
          </div>
        </fieldset>

        <section className="assign__section" aria-labelledby="assign-candidates">
          <h2 id="assign-candidates" className="assign__heading">
            후보 직원
          </h2>
          <AssignCandidates
            state={candidateState}
            employees={employees}
            selectedId={selectedId}
            locked={editing !== null}
            onPick={(employeeId) => {
              setSelectedId(employeeId)
              setErrors({})
            }}
            onRetry={() => {
              setCandidatesAttempt((count) => count + 1)
              setEmployeesAttempt((count) => count + 1)
            }}
          />
        </section>

        <section className="assign__section" aria-labelledby="assign-schedule">
          <h2 id="assign-schedule" className="assign__heading">
            선택한 직원 일정
          </h2>
          {schedule.phase === 'idle' ? <p className="assign__note">직원을 선택하면 일정이 보입니다</p> : null}
          {schedule.phase === 'loading' ? <p className="assign__loading">불러오는 중…</p> : null}
          {schedule.phase === 'error' ? <StateMessage kind="error" onRetry={() => setScheduleAttempt((count) => count + 1)} /> : null}
          {schedule.phase === 'ready' ? <Gantt assignments={bars} today={schedule.employee.today} /> : null}
        </section>

        <section className="assign__section" aria-labelledby="assign-form">
          <h2 id="assign-form" className="assign__heading">
            {editing ? `${editing.employeeName} 배치 수정` : '배치 입력'}
          </h2>
          <form className="assign__form" noValidate onSubmit={save}>
            <TextField
              label="투입률(%)"
              type="number"
              step={5}
              min={5}
              max={100}
              value={percentText}
              error={errors.percent}
              onChange={(event) => {
                setPercentText(event.target.value)
                clearError('percent')
              }}
            />
            {errors.form ? (
              <p className="field__error" role="alert">
                <WarningIcon size={16} />
                {errors.form}
              </p>
            ) : null}
            <div className="assign__actions">
              <Button type="submit" loading={saving} disabled={!editing && selectedId === null}>
                {editing ? '수정 저장' : '배치'}
              </Button>
              {editing ? (
                <Button variant="secondary" disabled={saving} onClick={endEditing}>
                  취소
                </Button>
              ) : null}
            </div>
          </form>
        </section>

        <section className="assign__section" aria-labelledby="assign-current">
          <h2 id="assign-current" className="assign__heading">
            현재 배치
          </h2>
          <DataTable
            columns={assignedColumns}
            rows={shown.assignments}
            rowKey={(row) => String(row.assignmentId)}
            empty={<StateMessage kind="empty" title="배치된 직원이 없습니다" />}
          />
        </section>

        {releasing ? (
          <ReleaseDialog
            projectName={shown.name}
            assignment={releasing}
            onClose={() => setReleasing(null)}
            onReleased={() => {
              // The assignment being changed is gone: leave the edit mode, or 수정 저장 would patch a deleted one.
              if (editing?.assignmentId === releasing.assignmentId) {
                endEditing()
              }
              setReleasing(null)
              setRefresh((count) => count + 1)
            }}
          />
        ) : null}
      </>
    )
  }

  return (
    <AppShell current="projects">
      <div ref={pageRef} className="assign" aria-busy={projectState.phase === 'loading' ? true : undefined}>
        {content}
      </div>
    </AppShell>
  )
}

// /projects/:id/assign: only a positive whole number is a project address (anything else goes where "*" goes), and only the
// project manager (D9) writes assignments; an account that only reads (the HR manager) is sent to the project detail.
export function ProjectAssignRoute() {
  const { id } = useParams()
  const { user } = useAuth()
  if (!id || !/^[1-9]\d*$/.test(id)) {
    return <Navigate to="/" replace />
  }
  if (!user?.roles.includes('PROJECT_MANAGER')) {
    return <Navigate to={`/projects/${id}`} replace />
  }
  return <ProjectAssignPage key={id} id={Number(id)} />
}

export default ProjectAssignPage
