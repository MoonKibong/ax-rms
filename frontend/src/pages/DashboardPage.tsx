import { useEffect, useId, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { apiFetch } from '../api/client'
import type { Dashboard } from '../api/dashboard'
import AppShell from '../components/AppShell'
import Badge from '../components/Badge'
import StateMessage from '../components/StateMessage'
import './pages.css'
import './DashboardPage.css'

// T#18, BRIEF §6.2 (D5, D35, D36). One GET /api/dashboard each time the screen opens; values are shown as the API
// returns them and only formatted (units, %, thousands separators, one decimal place).
type LoadState = { phase: 'loading' } | { phase: 'error' } | { phase: 'ready'; dashboard: Dashboard }

const count = (value: number) => value.toLocaleString('ko-KR')

type Tile = { label: string; unit: string; to: string; value: (dashboard: Dashboard) => number }

const TILES: Tile[] = [
  { label: '전체 직원', unit: '명', to: '/employees', value: (dashboard) => dashboard.employeeCount },
  { label: '투입 가능', unit: '명', to: '/employees?status=AVAILABLE', value: (dashboard) => dashboard.availableCount },
  { label: '투입 불가', unit: '명', to: '/employees?status=UNAVAILABLE', value: (dashboard) => dashboard.unavailableCount },
  // The employee list has no "availability above 0%" filter; 투입 가능 is the nearest list (contract, 제안).
  { label: '가용 인원', unit: '명', to: '/employees?status=AVAILABLE', value: (dashboard) => dashboard.availableHeadcount },
  {
    label: '진행 프로젝트',
    unit: '개',
    to: '/projects?status=IN_PROGRESS',
    value: (dashboard) => dashboard.ongoingProjectCount,
  },
]

type PanelProps<T> = {
  title: string
  items: T[] | null
  empty: { title: string; description?: string }
  itemKey: (item: T) => number
  renderItem: (item: T) => ReactNode
  onRetry: () => void
}

// One list of BRIEF §6.2 with its own state (D35): the items, its empty message, or an error with 다시 시도.
function Panel<T>({ title, items, empty, itemKey, renderItem, onRetry }: PanelProps<T>) {
  const headingId = useId()
  let content
  if (items === null) {
    content = <StateMessage kind="error" onRetry={onRetry} />
  } else if (items.length === 0) {
    content = <StateMessage kind="empty" title={empty.title} description={empty.description} />
  } else {
    content = (
      <ul className="dashboard-list__items">
        {items.map((item) => (
          <li key={itemKey(item)} className="dashboard-list__item">
            {renderItem(item)}
          </li>
        ))}
      </ul>
    )
  }
  return (
    <section className="dashboard-list" aria-labelledby={headingId}>
      <h2 id={headingId} className="dashboard-list__title">
        {title}
      </h2>
      {content}
    </section>
  )
}

function DashboardPage() {
  const [state, setState] = useState<LoadState>({ phase: 'loading' })
  const [attempt, setAttempt] = useState(0)

  // A new attempt (or leaving the screen) cancels the request before it; an answer after that is ignored.
  useEffect(() => {
    const controller = new AbortController()
    setState({ phase: 'loading' })
    apiFetch('/api/dashboard', { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) {
          // Read the error body too: an unread body keeps the request open in the browser.
          await response.text().catch(() => '')
          throw new Error(`status ${response.status}`)
        }
        return (await response.json()) as Dashboard
      })
      .then((dashboard) => {
        if (!controller.signal.aborted) {
          setState({ phase: 'ready', dashboard })
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setState({ phase: 'error' })
        }
      })
    return () => controller.abort()
  }, [attempt])

  const retry = () => setAttempt((value) => value + 1)
  const dashboard = state.phase === 'ready' ? state.dashboard : null

  let body
  if (state.phase === 'loading') {
    body = (
      <div className="dashboard__body" aria-busy="true">
        <p className="dashboard__loading">불러오는 중…</p>
      </div>
    )
  } else {
    body = (
      <div className="dashboard__body">
        <section className="dashboard__tiles" aria-label="요약">
          {TILES.map((tile) => (
            <Link key={tile.label} className="dashboard-tile" to={tile.to}>
              <span className="dashboard-tile__label">{tile.label}</span>
              {dashboard ? (
                <span className="dashboard-tile__figure">
                  <span className="dashboard-tile__value">{count(tile.value(dashboard))}</span>
                  <span className="dashboard-tile__unit">{tile.unit}</span>
                </span>
              ) : (
                <span className="dashboard-tile__figure">
                  <span className="dashboard-tile__value dashboard-tile__value--none">—</span>
                </span>
              )}
            </Link>
          ))}
        </section>
        <div className="dashboard__lists">
          <Panel
            title="확인 필요 배치"
            items={dashboard?.needsReview ?? null}
            empty={{ title: '확인이 필요한 배치가 없습니다', description: '투입 불가 직원에게 남은 배치가 없습니다.' }}
            itemKey={(employee) => employee.id}
            renderItem={(employee) => (
              <>
                <Link className="dashboard-list__link" to={`/employees/${employee.id}`}>
                  {employee.name}
                </Link>
                <Badge status="NEEDS_REVIEW" />
              </>
            )}
            onRetry={retry}
          />
          <Panel
            title="인력 부족 프로젝트"
            items={dashboard?.shortStaffedProjects ?? null}
            empty={{
              title: '인력이 부족한 프로젝트가 없습니다',
              description: '진행 중인 프로젝트의 인원과 필요 역량이 채워져 있습니다.',
            }}
            itemKey={(project) => project.id}
            renderItem={(project) => (
              <div className="dashboard-list__stack">
                <div className="dashboard-list__line">
                  <Link className="dashboard-list__link" to={`/projects/${project.id}`}>
                    {project.name}
                  </Link>
                  <Badge status="UNDERSTAFFED" />
                </div>
                <p className="dashboard-list__meta">
                  필요 {count(project.requiredHeadcount)}명 / 배치 {count(project.assignedHeadcount)}명
                </p>
                {project.missingSkills.length > 0 ? (
                  <p className="dashboard-list__meta">
                    부족한 역량:{' '}
                    {project.missingSkills
                      .map((line) => `${line.skill} ${count(line.requiredHeadcount)}명`)
                      .join(', ')}
                  </p>
                ) : null}
              </div>
            )}
            onRetry={retry}
          />
          {/* PM decision (issue #18, question 1): the titles say 가용률, the value the API gives (T#11, D36). */}
          <Panel
            title="직원별 가용률"
            items={dashboard?.employees ?? null}
            empty={{ title: '등록된 직원이 없습니다' }}
            itemKey={(employee) => employee.id}
            renderItem={(employee) => (
              <>
                <Link className="dashboard-list__link" to={`/employees/${employee.id}`}>
                  {employee.name}
                </Link>
                <span className="dashboard-list__value">{employee.currentAvailability}%</span>
              </>
            )}
            onRetry={retry}
          />
          <Panel
            title="부서별 평균 가용률"
            items={dashboard?.departments ?? null}
            empty={{ title: '등록된 부서가 없습니다' }}
            itemKey={(department) => department.id}
            renderItem={(department) => (
              <>
                <Link className="dashboard-list__link" to={`/employees?departmentId=${department.id}`}>
                  {department.name}
                </Link>
                <span className="dashboard-list__value">{department.averageAvailability.toFixed(1)}%</span>
              </>
            )}
            onRetry={retry}
          />
        </div>
      </div>
    )
  }

  return (
    <AppShell current="dashboard">
      <div className="dashboard">
        <h1 className="page__title">대시보드</h1>
        {body}
      </div>
    </AppShell>
  )
}

export default DashboardPage
