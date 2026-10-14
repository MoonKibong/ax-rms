import type { Page, Route } from '@playwright/test'

// T#15: the project list as the API returns it (T#9), used where a test replaces GET /api/projects.
export type Project = {
  id: number
  name: string
  startDate: string
  endDate: string
  status: 'PLANNED' | 'IN_PROGRESS' | 'DONE' | 'ON_HOLD'
  requiredHeadcount: number
  assignedHeadcount: number
  understaffed: boolean
}

export const LONG_NAME = 'abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJKL'

export const SAMPLE: Project[] = [
  {
    id: 7,
    name: LONG_NAME,
    startDate: '2026-05-16',
    endDate: '2026-09-13',
    status: 'IN_PROGRESS',
    requiredHeadcount: 5,
    assignedHeadcount: 3,
    understaffed: false,
  },
  {
    id: 8,
    name: '감마 프로젝트',
    startDate: '2025-10-08',
    endDate: '2026-03-07',
    status: 'DONE',
    requiredHeadcount: 2,
    assignedHeadcount: 0,
    understaffed: false,
  },
]

export function json(route: Route, body: unknown, status = 200): Promise<void> {
  return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
}

// Replaces GET /api/projects (any query). `requests` records path and query of every call that reaches the page.
export async function stubProjects(
  page: Page,
  handler: (route: Route, search: string) => Promise<void>,
): Promise<string[]> {
  const requests: string[] = []
  await page.route(
    (url) => url.pathname === '/api/projects',
    (route) => {
      const url = new URL(route.request().url())
      requests.push(url.pathname + url.search)
      return handler(route, url.search)
    },
  )
  return requests
}
