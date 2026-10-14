import { expect, test, type APIRequestContext, type Page } from '@playwright/test'
import { PROJECT_MANAGER, loginAs } from '../support/auth'
import { settle } from '../support/layout'

// T#32 criterion 6: real saves on the per-run DB of `scripts/e2e-servers.sh --fresh-db`. The alpha project needs two with
// Java and has three assigned (seed, D31). Releasing the three makes it short of people (D20); assigning two Java holders
// makes it enough again. The list API, the dashboard API (#11) and the screen must say the same, also after a reload (D36).
type Item = { id: number; name: string; understaffed: boolean }
type Assignment = {
  assignmentId: number
  employeeId: number
  startDate: string
  endDate: string
  allocationPercent: number
}
type Detail = { today: string; assignments: Assignment[] }

test.describe.configure({ mode: 'serial' })

test.beforeAll(() => {
  // Never against the shared e2e DB: without the runner's mark this spec fails before sending anything.
  if (process.env.E2E_DB !== 'fresh') {
    throw new Error('write 스펙은 scripts/e2e-servers.sh --fresh-db로만 실행합니다 (E2E_DB=fresh 아님)')
  }
})

async function listItems(request: APIRequestContext): Promise<Item[]> {
  const response = await request.get('/api/projects')
  expect(response.status(), 'GET /api/projects').toBe(200)
  return (await response.json()) as Item[]
}

async function dashboardIds(request: APIRequestContext): Promise<number[]> {
  const response = await request.get('/api/dashboard')
  expect(response.status(), 'GET /api/dashboard').toBe(200)
  const body = (await response.json()) as { shortStaffedProjects: Array<{ id: number }> }
  return body.shortStaffedProjects.map((project) => project.id).sort((a, b) => a - b)
}

async function flaggedIds(request: APIRequestContext): Promise<number[]> {
  return (await listItems(request)).filter((item) => item.understaffed).map((item) => item.id).sort((a, b) => a - b)
}

async function expectScreen(page: Page, flagged: string[]): Promise<void> {
  await page.goto('/projects')
  await page.getByRole('navigation').first().waitFor()
  await expect(page.locator('main table')).toHaveCount(1)
  await settle(page)
  for (const name of ['알파 프로젝트', '감마 프로젝트', '베타 프로젝트', '델타 프로젝트', '엡실론 프로젝트']) {
    const badge = page.locator('main tbody tr', { has: page.getByRole('link', { name, exact: true }) }).locator('[data-status="UNDERSTAFFED"]')
    await expect(badge, `${name} badge`).toHaveCount(flagged.includes(name) ? 1 : 0)
  }
}

test('a project short of people shows the badge, the same projects as the dashboard, and enough people take it away', async ({ page, request }) => {
  await loginAs(page, PROJECT_MANAGER)
  const login = await request.post('/api/auth/login', { data: { username: PROJECT_MANAGER.username, password: PROJECT_MANAGER.password } })
  expect(login.status(), 'project.manager login').toBe(200)
  const items = await listItems(request)
  const alpha = items.find((item) => item.name === '알파 프로젝트')!
  expect(await flaggedIds(request), 'before: nobody is short').toEqual([])
  const employees = (await (await request.get('/api/employees')).json()) as Array<{ id: number; name: string }>
  const idOf = (name: string) => employees.find((employee) => employee.name === name)!.id
  const detail = (await (await request.get(`/api/projects/${alpha.id}`)).json()) as Detail
  expect(detail.assignments).toHaveLength(3)
  const today = ((await (await request.get(`/api/employees/${idOf('박소영')}`)).json()) as { today: string }).today

  const created: number[] = []
  try {
    // Release the three assignments: 0 people against the 2 that are needed.
    for (const assignment of detail.assignments) {
      const released = await request.delete(`/api/assignments/${assignment.assignmentId}`)
      expect(released.status(), 'DELETE /api/assignments').toBe(204)
    }
    expect(await flaggedIds(request), 'list API after the release').toEqual([alpha.id])
    expect(await dashboardIds(request), 'dashboard API after the release').toEqual([alpha.id])
    await expectScreen(page, ['알파 프로젝트'])
    await page.reload()
    await page.getByRole('navigation').first().waitFor()
    await expectScreen(page, ['알파 프로젝트'])

    // Two Java holders for the next ten days: enough people with the skill, so the badge goes.
    const until = new Date(`${today}T00:00:00Z`)
    until.setUTCDate(until.getUTCDate() + 10)
    for (const name of ['박소영', '한지우']) {
      const answer = await request.post('/api/assignments', {
        data: { employeeId: idOf(name), projectId: alpha.id, startDate: today, endDate: until.toISOString().slice(0, 10), allocationPercent: 20 },
      })
      expect(answer.status(), `POST /api/assignments ${name} (${await answer.text()})`).toBe(201)
      created.push(((await answer.json()) as { id: number }).id)
    }
    expect(await flaggedIds(request), 'list API after the assignments').toEqual([])
    expect(await dashboardIds(request), 'dashboard API after the assignments').toEqual([])
    await expectScreen(page, [])
  } finally {
    // The write specs of one run share one DB (alphabetical order): leave the alpha project as the seed made it, so a spec
    // after this one (project-write.spec.ts counts alpha's assignments) sees the same data as before.
    for (const id of created) {
      await request.delete(`/api/assignments/${id}`)
    }
    const now = (await (await request.get(`/api/projects/${alpha.id}`)).json()) as Detail
    if (now.assignments.length === 0) {
      for (const original of detail.assignments) {
        const restored = await request.post('/api/assignments', {
          data: {
            employeeId: original.employeeId,
            projectId: alpha.id,
            startDate: original.startDate,
            endDate: original.endDate,
            allocationPercent: original.allocationPercent,
          },
        })
        expect(restored.status(), `restore ${original.employeeId} (${await restored.text()})`).toBe(201)
      }
    }
    expect(await flaggedIds(request), 'after restoring the seed: nobody is short').toEqual([])
  }
})
