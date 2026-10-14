import type { Page, Route } from '@playwright/test'

// T#13: the employee list as the API returns it (T#8, with `skills` from T#13), used where a test replaces
// GET /api/employees, and the values the screen should show for it.
export type Employee = {
  id: number
  name: string
  departmentId: number
  departmentName: string
  jobTitle: string
  careerYears: number
  availabilityStatus: 'AVAILABLE' | 'UNAVAILABLE'
  currentAvailability: number
  needsReview: boolean
  skills: Array<{ skillName: string; proficiencyLevel: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED' }>
}

export const LONG_NAME = 'abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJKL'
export const LONG_SKILL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789abcdefghijkl'

export const SAMPLE: Employee[] = [
  {
    id: 1,
    name: '박소영',
    departmentId: 1,
    departmentName: '개발팀',
    jobTitle: '백엔드 개발자',
    careerYears: 5,
    availabilityStatus: 'AVAILABLE',
    currentAvailability: 40,
    needsReview: false,
    skills: [
      { skillName: 'Java', proficiencyLevel: 'ADVANCED' },
      { skillName: 'React', proficiencyLevel: 'BEGINNER' },
    ],
  },
  {
    id: 2,
    name: '최동훈',
    departmentId: 1,
    departmentName: '개발팀',
    jobTitle: '프런트엔드 개발자',
    careerYears: 3,
    availabilityStatus: 'UNAVAILABLE',
    currentAvailability: 100,
    needsReview: true,
    skills: [],
  },
  {
    id: 3,
    name: LONG_NAME,
    departmentId: 3,
    departmentName: '디자인팀',
    jobTitle: '디자이너',
    careerYears: 2,
    availabilityStatus: 'AVAILABLE',
    currentAvailability: 0,
    needsReview: false,
    skills: [{ skillName: LONG_SKILL, proficiencyLevel: 'INTERMEDIATE' }],
  },
]

const STATUS_LABELS = { AVAILABLE: '투입 가능', UNAVAILABLE: '투입 불가' }

// The cells of one row as the contract's "구성" writes them: skills joined with ", " or "—", the rate as "40%", and
// 확인 필요 or "—".
export function expectedRows(employees: Employee[]): string[][] {
  return employees.map((employee) => [
    employee.name,
    employee.departmentName,
    employee.jobTitle,
    employee.skills.map((skill) => skill.skillName).join(', ') || '—',
    STATUS_LABELS[employee.availabilityStatus],
    `${employee.currentAvailability}%`,
    employee.needsReview ? '확인 필요' : '—',
  ])
}

// The cells of every row on the screen, in order.
export function rowsOf(page: Page): Promise<string[][]> {
  return page
    .locator('tbody tr')
    .evaluateAll((rows) =>
      rows.map((row) => Array.from(row.querySelectorAll('td')).map((cell) => (cell.textContent ?? '').trim())),
    )
}

// Replaces GET /api/employees (any query). `requests` records path and query of every call that reaches the page.
export async function stubEmployees(
  page: Page,
  handler: (route: Route, search: string) => Promise<void>,
): Promise<string[]> {
  const requests: string[] = []
  await page.route(
    (url) => url.pathname === '/api/employees',
    (route) => {
      const url = new URL(route.request().url())
      requests.push(url.pathname + url.search)
      return handler(route, url.search)
    },
  )
  return requests
}
