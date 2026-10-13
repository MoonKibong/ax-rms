import type { ProjectStatus } from '../api/projects'
import './Badge.css'

// BRIEF §3.6. The status is always written out; colour only backs it up (D13).
const LABELS: Record<ProjectStatus, string> = {
  PLANNED: '계획',
  IN_PROGRESS: '진행 중',
  DONE: '완료',
  ON_HOLD: '보류',
}

function Badge({ status }: { status: ProjectStatus }) {
  return (
    <span className="badge" data-status={status}>
      {LABELS[status]}
    </span>
  )
}

export default Badge
