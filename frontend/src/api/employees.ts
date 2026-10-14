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

// T#39: the body of POST /api/employees and PUT /api/employees/{id} (T#8). The server judges every rule (D33).
export type EmployeeUpsert = {
  name: string
  departmentId: number | null
  jobTitle: string
  careerYears: number | null
  skills: Array<{ skillName: string; proficiencyLevel: ProficiencyLevel | '' }>
}

// T#39: the body of PATCH /api/employees/{id}/status (T#8, D6).
export type EmployeeStatusChange = {
  availabilityStatus: AvailabilityStatus
  unavailableReason: string | null
  unavailableUntil: string | null
}

// An error answer of the API (D33): its cause code and Korean message, when the body has them.
export type ApiFailure = { status: number; code?: string; message?: string }

// Reads an error answer whatever its body is (also Spring's own 400 without a code, or no JSON at all).
export async function readFailure(response: Response): Promise<ApiFailure> {
  const body: unknown = await response.json().catch(() => null)
  const text = (key: 'code' | 'message') =>
    body !== null && typeof body === 'object' && key in body && typeof (body as Record<string, unknown>)[key] === 'string'
      ? ((body as Record<string, unknown>)[key] as string)
      : undefined
  return { status: response.status, code: text('code'), message: text('message') }
}

// The message shown when a save failed without an answer the screen can place (contract "서버 오류의 자리").
export const SAVE_FAILED = '저장하지 못했습니다. 잠시 후 다시 시도하세요.'
