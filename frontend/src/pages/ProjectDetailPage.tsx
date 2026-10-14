import { useEffect, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router'
import type { AssignedEmployee, ProficiencyLevel, ProjectDetail, RequiredSkill } from '../api/projects'
import { useAuth } from '../auth/AuthContext'
import AppShell from '../components/AppShell'
import Badge from '../components/Badge'
import ButtonLink from '../components/ButtonLink'
import DataTable, { type Column } from '../components/DataTable'
import Period from '../components/Period'
import StateMessage from '../components/StateMessage'
import './pages.css'
import './ProjectDetailPage.css'

// T#16, BRIEF §6.6 (D3, D22). Values are shown as the API returns them (D36); the screen computes nothing.
const LEVELS: Record<ProficiencyLevel, string> = { BEGINNER: '초급', INTERMEDIATE: '중급', ADVANCED: '고급' }

const SKILL_COLUMNS: Column<RequiredSkill>[] = [
  { key: 'jobTitle', header: '직무' },
  { key: 'skillName', header: '기술' },
  { key: 'proficiencyLevel', header: '숙련도', render: (skill) => LEVELS[skill.proficiencyLevel] },
  { key: 'headcount', header: '인원', align: 'end' },
]

const ASSIGNED_COLUMNS: Column<AssignedEmployee>[] = [
  {
    key: 'employeeName',
    header: '직원',
    render: (row) => (
      <Link className="project-detail__link" to={`/employees/${row.employeeId}`}>
        {row.employeeName}
      </Link>
    ),
  },
  { key: 'startDate', header: '기간', render: (row) => <Period startDate={row.startDate} endDate={row.endDate} /> },
  { key: 'allocationPercent', header: '투입률', align: 'end', render: (row) => `${row.allocationPercent}%` },
]

type LoadState = { phase: 'loading' } | { phase: 'error' } | { phase: 'missing' } | { phase: 'ready'; project: ProjectDetail }

function ProjectDetailPage({ id }: { id: number }) {
  const { user } = useAuth()
  const canManage = user?.roles.includes('PROJECT_MANAGER') ?? false
  const [state, setState] = useState<LoadState>({ phase: 'loading' })
  const [attempt, setAttempt] = useState(0)

  // A new id or a retry cancels the request before, and an answer that comes after that is ignored.
  useEffect(() => {
    const controller = new AbortController()
    setState({ phase: 'loading' })
    fetch(`/api/projects/${id}`, { signal: controller.signal })
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
      .then((project) => {
        if (!controller.signal.aborted) {
          setState(project ? { phase: 'ready', project } : { phase: 'missing' })
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setState({ phase: 'error' })
        }
      })
    return () => controller.abort()
  }, [id, attempt])

  let content
  if (state.phase === 'loading') {
    content = <p className="project-detail__loading">불러오는 중…</p>
  } else if (state.phase === 'error') {
    content = <StateMessage kind="error" onRetry={() => setAttempt((count) => count + 1)} />
  } else if (state.phase === 'missing') {
    content = (
      <div className="project-detail__missing">
        <StateMessage kind="empty" title="프로젝트를 찾을 수 없습니다" description="주소를 확인하거나 목록에서 다시 고르세요." />
        <ButtonLink to="/projects" variant="secondary">
          프로젝트 목록
        </ButtonLink>
      </div>
    )
  } else {
    const { project } = state
    content = (
      <>
        <div className="project-detail__title">
          <h1 className="page__title">{project.name}</h1>
          <Badge status={project.status} />
        </div>
        <p className="project-detail__period">
          {project.startDate}
          {' ~ '}
          {project.endDate}
        </p>
        <p className={project.description === null ? 'project-detail__description project-detail__description--empty' : 'project-detail__description'}>
          {project.description ?? '—'}
        </p>
        <p className="project-detail__headcount">{`필요 ${project.requiredHeadcount}명 / 배치 ${project.assignedHeadcount}명`}</p>
        <section className="project-detail__section" aria-labelledby="project-detail-skills">
          <h2 id="project-detail-skills" className="project-detail__heading">
            필요 역량
          </h2>
          <DataTable
            columns={SKILL_COLUMNS}
            rows={project.requiredSkills}
            rowKey={(skill) => `${skill.jobTitle}|${skill.skillName}|${skill.proficiencyLevel}`}
            empty={<StateMessage kind="empty" title="등록된 필요 역량이 없습니다" />}
          />
        </section>
        <section className="project-detail__section" aria-labelledby="project-detail-assigned">
          <h2 id="project-detail-assigned" className="project-detail__heading">
            배치 인력
          </h2>
          <DataTable
            columns={ASSIGNED_COLUMNS}
            rows={project.assignments}
            rowKey={(row) => String(row.assignmentId)}
            empty={<StateMessage kind="empty" title="배치된 직원이 없습니다" />}
          />
        </section>
        {canManage ? (
          <div className="project-detail__actions">
            <ButtonLink to={`/projects/${project.id}/assign`}>인력 배치</ButtonLink>
            <ButtonLink to={`/projects/${project.id}/edit`} variant="secondary" className="manage-only">
              수정
            </ButtonLink>
          </div>
        ) : null}
      </>
    )
  }

  return (
    <AppShell current="projects">
      <div className="project-detail" aria-busy={state.phase === 'loading' ? true : undefined}>
        {content}
      </div>
    </AppShell>
  )
}

// /projects/:id: only a positive whole number is a project address; anything else goes where "*" goes (T#16).
export function ProjectDetailRoute() {
  const { id } = useParams()
  if (!id || !/^[1-9]\d*$/.test(id)) {
    return <Navigate to="/" replace />
  }
  return <ProjectDetailPage id={Number(id)} />
}

export default ProjectDetailPage
