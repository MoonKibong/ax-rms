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
