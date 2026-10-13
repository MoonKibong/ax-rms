import type { ProjectStatus } from './projects'

// T#13: the employee list API (T#8 `GET /api/employees`, with `skills` added by T#13). The screen shows these values as
// they come (D36); it does not compute availability or 확인 필요 itself.
export type AvailabilityStatus = 'AVAILABLE' | 'UNAVAILABLE'

export type ProficiencyLevel = 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED'

export type EmployeeSkill = { skillName: string; proficiencyLevel: ProficiencyLevel }

export type EmployeeListItem = {
  id: number
  name: string
  departmentId: number
  departmentName: string
  jobTitle: string
  careerYears: number
  availabilityStatus: AvailabilityStatus
  currentAvailability: number
  needsReview: boolean
  skills: EmployeeSkill[]
}

// T#38: one assignment of the employee detail (T#8), ended projects included (D15), by start date.
export type EmployeeAssignment = {
  projectId: number
  projectName: string
  projectStatus: ProjectStatus
  startDate: string
  endDate: string
  allocationPercent: number
}

// T#38: the employee detail (T#8 `GET /api/employees/{id}`, T#28 `GET /api/me/employee`). `today` is the server's date
// that availability and 확인 필요 were computed for (D19); the Gantt draws its today line there.
export type EmployeeDetail = {
  id: number
  name: string
  departmentId: number
  departmentName: string
  jobTitle: string
  careerYears: number
  availabilityStatus: AvailabilityStatus
  unavailableReason: string | null
  unavailableUntil: string | null
  currentAvailability: number
  needsReview: boolean
  skills: EmployeeSkill[]
  assignments: EmployeeAssignment[]
  today: string
}
