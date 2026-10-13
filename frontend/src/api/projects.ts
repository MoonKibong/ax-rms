// T#15: the project list API (T#9 `GET /api/projects`). The screen shows these values as they come (D36).
export type ProjectStatus = 'PLANNED' | 'IN_PROGRESS' | 'DONE' | 'ON_HOLD'

export type ProjectSummary = {
  id: number
  name: string
  startDate: string
  endDate: string
  status: ProjectStatus
  requiredHeadcount: number
  assignedHeadcount: number
}

export const PROJECT_STATUSES: ProjectStatus[] = ['PLANNED', 'IN_PROGRESS', 'DONE', 'ON_HOLD']
