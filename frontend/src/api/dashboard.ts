// T#18: GET /api/dashboard (T#11, D5). The screen shows these values as they come (D36); it computes nothing.
export type MissingSkill = {
  skill: string
  requiredHeadcount: number
}

export type ShortStaffedProject = {
  id: number
  name: string
  requiredHeadcount: number
  assignedHeadcount: number
  missingSkills: MissingSkill[]
}

export type EmployeeAvailability = {
  id: number
  name: string
  currentAvailability: number
}

// averageAvailability is rounded to one decimal place by the server (70.6, 72.0).
export type DepartmentAverage = {
  id: number
  name: string
  averageAvailability: number
}

export type EmployeeRef = {
  id: number
  name: string
}

export type Dashboard = {
  employeeCount: number
  availableCount: number
  unavailableCount: number
  availableHeadcount: number
  ongoingProjectCount: number
  shortStaffedProjects: ShortStaffedProject[]
  employees: EmployeeAvailability[]
  departments: DepartmentAverage[]
  needsReview: EmployeeRef[]
}
