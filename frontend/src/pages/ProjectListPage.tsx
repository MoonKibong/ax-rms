import { useContext, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { apiFetch } from '../api/client'
import { PROJECT_STATUSES, type ProjectStatus, type ProjectSummary } from '../api/projects'
import { AuthContext } from '../auth/AuthContext'
import AppShell from '../components/AppShell'
import Badge from '../components/Badge'
import ButtonLink from '../components/ButtonLink'
import DataTable, { type Column } from '../components/DataTable'
import Period from '../components/Period'
import SegmentedControl, { type SegmentedOption } from '../components/SegmentedControl'
import StateMessage from '../components/StateMessage'
import './pages.css'
import './ProjectListPage.css'

// T#15, BRIEF §6.5 (D3, D35). Values are shown as the API returns them (D36); the screen computes nothing.
const FILTERS: SegmentedOption[] = [
  { value: '', label: '전체' },
  { value: 'PLANNED', label: '계획' },
  { value: 'IN_PROGRESS', label: '진행 중' },
  { value: 'DONE', label: '완료' },
  { value: 'ON_HOLD', label: '보류' },
]

type LoadState = { phase: 'loading' } | { phase: 'error' } | { phase: 'ready'; projects: ProjectSummary[] }

function isStatus(value: string): value is ProjectStatus {
  return (PROJECT_STATUSES as string[]).includes(value)
}

const NONE = <span className="project-list__none">—</span>

const COLUMNS: Column<ProjectSummary>[] = [
  {
    key: 'name',
    header: '프로젝트명',
    render: (project) => (
      <Link className="project-list__link" to={`/projects/${project.id}`}>
        {project.name}
      </Link>
    ),
  },
  { key: 'status', header: '상태', render: (project) => <Badge status={project.status} /> },
  { key: 'startDate', header: '기간', render: (project) => <Period startDate={project.startDate} endDate={project.endDate} /> },
  { key: 'requiredHeadcount', header: '필요 인원', align: 'end' },
  { key: 'assignedHeadcount', header: '배치 인원', align: 'end' },
  // T#32 (D20, D36): the backend's own answer; the screen never works it out from the two headcounts.
  { key: 'understaffed', header: '인력 부족', render: (project) => (project.understaffed ? <Badge status="UNDERSTAFFED" /> : NONE) },
]

function ProjectListPage() {
  // Nullable on purpose: the list also renders without a provider (T#15 tests); then no write button is drawn.
  const user = useContext(AuthContext)?.user ?? null
  const canManage = user?.roles.includes('PROJECT_MANAGER') ?? false
  const [params, setParams] = useSearchParams()
  const raw = params.get('status') ?? ''
  const status = isStatus(raw) ? raw : ''
  const [state, setState] = useState<LoadState>({ phase: 'loading' })
  const [attempt, setAttempt] = useState(0)

  // One request at a time that counts: a new filter (or a retry) cancels the one before, and an answer that comes
  // after that is ignored, so the screen always shows the last choice.
  useEffect(() => {
    const controller = new AbortController()
    setState({ phase: 'loading' })
    const url = status ? `/api/projects?status=${status}` : '/api/projects'
    apiFetch(url, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) {
          // Read the error body too: an unread body keeps the request open in the browser.
          await response.text().catch(() => '')
          throw new Error(`status ${response.status}`)
        }
        return (await response.json()) as ProjectSummary[]
      })
      .then((projects) => {
        if (!controller.signal.aborted) {
          setState({ phase: 'ready', projects })
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setState({ phase: 'error' })
        }
      })
    return () => controller.abort()
  }, [status, attempt])

  function chooseStatus(value: string) {
    setParams(value ? { status: value } : {})
  }

  let content
  if (state.phase === 'loading') {
    content = <p className="project-list__loading">불러오는 중…</p>
  } else if (state.phase === 'error') {
    content = <StateMessage kind="error" onRetry={() => setAttempt((count) => count + 1)} />
  } else if (state.projects.length === 0) {
    content = status ? (
      <StateMessage kind="no-results" title="이 상태의 프로젝트가 없습니다" onReset={() => chooseStatus('')} />
    ) : (
      <StateMessage kind="empty" title="등록된 프로젝트가 없습니다" />
    )
  } else {
    content = <DataTable columns={COLUMNS} rows={state.projects} rowKey={(project) => String(project.id)} empty={null} />
  }

  return (
    <AppShell current="projects">
      <div className="project-list">
        <div className="page__head">
          <h1 className="page__title">프로젝트</h1>
          {canManage ? (
            <ButtonLink to="/projects/new" className="manage-only">
              프로젝트 등록
            </ButtonLink>
          ) : null}
        </div>
        <SegmentedControl label="상태 필터" options={FILTERS} value={status} onChange={chooseStatus} />
        <div className="project-list__result" aria-busy={state.phase === 'loading' ? true : undefined}>
          {content}
        </div>
      </div>
    </AppShell>
  )
}

export default ProjectListPage
