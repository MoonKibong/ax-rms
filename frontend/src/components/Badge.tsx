import type { AvailabilityStatus } from '../api/employees'
import type { ProjectStatus } from '../api/projects'
import './Badge.css'

// The statuses a badge writes out: project status (D13, T#15), employee availability (D6) and 확인 필요 (D21, T#13).
export type BadgeStatus = ProjectStatus | AvailabilityStatus | 'NEEDS_REVIEW'

// BRIEF §3.6. The status is always written out; colour only backs it up (D13).
const LABELS: Record<BadgeStatus, string> = {
  PLANNED: '계획',
  IN_PROGRESS: '진행 중',
  DONE: '완료',
  ON_HOLD: '보류',
  AVAILABLE: '투입 가능',
  UNAVAILABLE: '투입 불가',
  NEEDS_REVIEW: '확인 필요',
}

function Badge({ status }: { status: BadgeStatus }) {
  return (
    <span className="badge" data-status={status}>
      {LABELS[status]}
    </span>
  )
}

export default Badge
