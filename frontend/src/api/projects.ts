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

export type ProficiencyLevel = 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED'

export type RequiredSkill = {
  jobTitle: string
  skillName: string
  proficiencyLevel: ProficiencyLevel
  headcount: number
}

export type AssignedEmployee = {
  assignmentId: number
  employeeId: number
  employeeName: string
  startDate: string
  endDate: string
  allocationPercent: number
  currentAvailability: number
}

// T#16: GET /api/projects/{id} (T#9).
export type ProjectDetail = {
  id: number
  name: string
  description: string | null
  startDate: string
  endDate: string
  status: ProjectStatus
  requiredSkills: RequiredSkill[]
  requiredHeadcount: number
  assignedHeadcount: number
  assignments: AssignedEmployee[]
}
