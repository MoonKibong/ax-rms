import { expect, type Page, type Route } from '@playwright/test'
import { settle } from './layout'

// T#18: GET /api/dashboard as the API returns it (T#11), used where a test replaces it.
export type Dashboard = {
  employeeCount: number
  availableCount: number
  unavailableCount: number
  availableHeadcount: number
  ongoingProjectCount: number
  shortStaffedProjects: Array<{
    id: number
    name: string
    requiredHeadcount: number
    assignedHeadcount: number
    missingSkills: Array<{ skill: string; requiredHeadcount: number }>
  }>
  employees: Array<{ id: number; name: string; currentAvailability: number }>
  departments: Array<{ id: number; name: string; averageAvailability: number }>
  needsReview: Array<{ id: number; name: string }>
}

// 48 characters without spaces or hyphens (BRIEF §5 "긴 값").
export const LONG_EMPLOYEE = 'employeenamewithoutanyspacesorhyphensatall000048'
export const LONG_PROJECT = 'projectnamewithoutanyspacesorhyphensatall0000048'

// Every list has items, with a long employee name and a long project name.
export const WITH_ITEMS: Dashboard = {
  employeeCount: 1234,
  availableCount: 1200,
  unavailableCount: 34,
  availableHeadcount: 1180,
  ongoingProjectCount: 12,
  shortStaffedProjects: [
    {
      id: 1,
      name: '알파 프로젝트',
      requiredHeadcount: 2,
      assignedHeadcount: 1,
      missingSkills: [{ skill: 'Java', requiredHeadcount: 2 }],
    },
    {
      id: 2,
      name: LONG_PROJECT,
      requiredHeadcount: 5,
      assignedHeadcount: 3,
      missingSkills: [
        { skill: 'React', requiredHeadcount: 1 },
        { skill: 'Kubernetes', requiredHeadcount: 2 },
      ],
    },
  ],
  employees: [
    { id: 1, name: '박소영', currentAvailability: 40 },
    { id: 2, name: '최동훈', currentAvailability: 60 },
    { id: 3, name: LONG_EMPLOYEE, currentAvailability: 100 },
    { id: 4, name: '정하늘', currentAvailability: 0 },
  ],
  departments: [
    { id: 1, name: '개발팀', averageAvailability: 70.6 },
    { id: 2, name: '기획팀', averageAvailability: 93.6 },
    { id: 3, name: '디자인팀', averageAvailability: 72.0 },
  ],
  needsReview: [
    { id: 2, name: '최동훈' },
    { id: 3, name: LONG_EMPLOYEE },
  ],
}

export const EMPTY: Dashboard = {
  employeeCount: 0,
  availableCount: 0,
  unavailableCount: 0,
  availableHeadcount: 0,
  ongoingProjectCount: 0,
  shortStaffedProjects: [],
  employees: [],
  departments: [],
  needsReview: [],
}

export const LIST_TITLES = ['확인 필요 배치', '인력 부족 프로젝트', '직원별 가용률', '부서별 평균 가용률']

export const EMPTY_TITLES = [
  '확인이 필요한 배치가 없습니다',
  '인력이 부족한 프로젝트가 없습니다',
  '등록된 직원이 없습니다',
  '등록된 부서가 없습니다',
]

export function json(route: Route, body: unknown, status = 200): Promise<void> {
  return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
}

// Replaces GET /api/dashboard. The returned array counts the calls that reach the page.
export async function stubDashboard(page: Page, handler: (route: Route) => Promise<void>): Promise<string[]> {
  const requests: string[] = []
  await page.route(
    (url) => url.pathname === '/api/dashboard',
    (route) => {
      requests.push(new URL(route.request().url()).pathname)
      return handler(route)
    },
  )
  return requests
}

// Opens a screen at a width, after the login check (GET /api/auth/me) has drawn the shell.
export async function openAt(page: Page, width: number, path = '/'): Promise<void> {
  await page.setViewportSize({ width, height: 800 })
  await page.goto(path)
  await page.getByRole('navigation').first().waitFor()
  await settle(page)
}

// The dashboard title is on the screen at once; the tiles and lists follow the answer.
export async function expectDashboard(page: Page): Promise<void> {
  expect(await page.getByRole('heading', { level: 1, name: '대시보드' }).count(), 'dashboard headings').toBe(1)
}

export const region = (page: Page, name: string) => page.getByRole('region', { name, exact: true })
