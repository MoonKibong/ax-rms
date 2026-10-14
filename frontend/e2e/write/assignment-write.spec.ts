import { expect, test, type APIRequestContext, type Page } from '@playwright/test'
import { PROJECT_MANAGER, loginAs } from '../support/auth'
import { addDays, assignButton, candidatesRegion, currentRegion, expectHeading, percentInput } from '../support/assign'
import { settle } from '../support/layout'

// T#17 criterion 9: real saves on the per-run DB of `scripts/e2e-servers.sh --fresh-db`. 박소영 has 60% on the 알파 프로젝트
// and 최동훈 is unavailable (seed, D31). Every figure the candidate table shows is compared with the candidates API asked for
// the same period: the table shows the availability of the chosen period (D18), not today's.
type Detail = {
  id: number
  today: string
  assignments: Array<{ projectId: number; projectName: string; startDate: string; endDate: string; allocationPercent: number }>
}

test.describe.configure({ mode: 'serial' })

test.beforeAll(() => {
  // Never against the shared e2e DB: without the runner's mark this spec fails before sending anything.
  if (process.env.E2E_DB !== 'fresh') {
    throw new Error('write 스펙은 scripts/e2e-servers.sh --fresh-db로만 실행합니다 (E2E_DB=fresh 아님)')
  }
})

async function asProjectManager(request: APIRequestContext): Promise<void> {
  const login = await request.post('/api/auth/login', { data: { username: PROJECT_MANAGER.username, password: PROJECT_MANAGER.password } })
  expect(login.status(), 'project.manager login').toBe(200)
}

async function idOf(request: APIRequestContext, path: string, name: string): Promise<number> {
  const response = await request.get(path)
  expect(response.status(), `GET ${path}`).toBe(200)
  return ((await response.json()) as Array<{ id: number; name: string }>).find((item) => item.name === name)!.id
}

async function detailOf(request: APIRequestContext, employeeId: number): Promise<Detail> {
  const response = await request.get(`/api/employees/${employeeId}`)
  expect(response.status(), `GET /api/employees/${employeeId}`).toBe(200)
  return (await response.json()) as Detail
}

async function periodAvailability(request: APIRequestContext, projectId: number, start: string, end: string, employeeId: number): Promise<number> {
  const response = await request.get(`/api/assignments/candidates?projectId=${projectId}&startDate=${start}&endDate=${end}`)
  expect(response.status(), 'GET /api/assignments/candidates').toBe(200)
  const rows = (await response.json()) as Array<{ employeeId: number; periodAvailability: number }>
  return rows.find((row) => row.employeeId === employeeId)!.periodAvailability
}

const ids: { betaId: number; soyoung: number; donghun: number; today: string } = { betaId: 0, soyoung: 0, donghun: 0, today: '' }
let initialAvailability = 0

// The candidate table's cell for a name equals what the API says for the period the inputs hold now.
async function expectCandidateMatchesApi(page: Page, request: APIRequestContext, name: string, employeeId: number): Promise<number> {
  const start = await page.getByLabel('시작일').inputValue()
  const end = await page.getByLabel('종료일').inputValue()
  const expected = await periodAvailability(request, ids.betaId, start, end, employeeId)
  const row = candidatesRegion(page).locator('tbody tr', { has: page.getByRole('button', { name, exact: true }) })
  await expect(row.locator('td').nth(4)).toHaveText(`${expected}%`)
  return expected
}

async function openBeta(page: Page): Promise<void> {
  await page.goto(`/projects/${ids.betaId}/assign`)
  await page.getByRole('navigation').first().waitFor()
  await settle(page)
  await expectHeading(page, '베타 프로젝트')
}

async function setPeriod(page: Page, start: string, end: string): Promise<void> {
  const answered = page.waitForResponse((response) => response.url().includes('/api/assignments/candidates') && response.url().includes(`endDate=${end}`))
  await page.getByLabel('시작일').fill(start)
  await page.getByLabel('종료일').fill(end)
  await answered
  await settle(page)
}

test('rejected and accepted assignments, a change and a release are saved and read back', async ({ page, request }) => {
  await loginAs(page, PROJECT_MANAGER)
  await asProjectManager(request)
  ids.betaId = await idOf(request, '/api/projects', '베타 프로젝트')
  ids.soyoung = await idOf(request, '/api/employees', '박소영')
  ids.donghun = await idOf(request, '/api/employees', '최동훈')
  const before = await detailOf(request, ids.soyoung)
  ids.today = before.today
  const donghunBefore = await detailOf(request, ids.donghun)
  // The default period is the project's: 박소영's 60% of the alpha project makes her availability the lowest day.
  const project = (await (await request.get(`/api/projects/${ids.betaId}`)).json()) as { startDate: string; endDate: string }
  initialAvailability = await periodAvailability(request, ids.betaId, project.startDate, project.endDate, ids.soyoung)
  const start = ids.today
  const end = addDays(ids.today, 10)

  await openBeta(page)
  await setPeriod(page, start, end)
  await candidatesRegion(page).getByRole('button', { name: '박소영', exact: true }).click()

  // (a) 60% + 50% is over 100%: the cause is under the percent and nothing is saved.
  await percentInput(page).fill('50')
  await assignButton(page).click()
  await expect(page.getByLabel('투입률(%)')).toHaveAttribute('aria-invalid', 'true')
  await expect(page.getByText('대상 기간에 투입률 합계가 100%를 초과합니다.')).toBeVisible()
  expect((await detailOf(request, ids.soyoung)).assignments.filter((a) => a.projectName === '베타 프로젝트')).toEqual(
    before.assignments.filter((a) => a.projectName === '베타 프로젝트'),
  )

  // (b) 30% fits: the row appears, the availability is the API's, and it stays so after a reload.
  await percentInput(page).fill('30')
  await assignButton(page).click()
  await expect(currentRegion(page).locator('tbody tr', { hasText: '박소영' }).locator('td').nth(2)).toHaveText('30%')
  await expect(percentInput(page)).toHaveValue('')
  const afterAssign = await expectCandidateMatchesApi(page, request, '박소영', ids.soyoung)
  expect(afterAssign).toBeLessThan(initialAvailability + 1)
  const saved = (await detailOf(request, ids.soyoung)).assignments.filter((a) => a.projectName === '베타 프로젝트')
  expect(saved.map((a) => a.allocationPercent)).toContain(30)
  await page.reload()
  await page.getByRole('navigation').first().waitFor()
  await settle(page)
  await expect(currentRegion(page).locator('tbody tr', { hasText: '박소영' }).locator('td').nth(2)).toHaveText('30%')
  await expectCandidateMatchesApi(page, request, '박소영', ids.soyoung)

  // (c) change it to 40%.
  await currentRegion(page).locator('tbody tr', { hasText: '박소영' }).getByRole('button', { name: '수정' }).click()
  await expect(percentInput(page)).toHaveValue('30')
  await percentInput(page).fill('40')
  await page.getByRole('button', { name: '수정 저장' }).click()
  await expect(currentRegion(page).locator('tbody tr', { hasText: '박소영' }).locator('td').nth(2)).toHaveText('40%')
  await expectCandidateMatchesApi(page, request, '박소영', ids.soyoung)
  expect((await detailOf(request, ids.soyoung)).assignments.filter((a) => a.projectName === '베타 프로젝트').map((a) => a.allocationPercent)).toContain(40)

  // (d) an unavailable employee cannot be assigned: the cause is above the button and nothing is saved.
  await candidatesRegion(page).getByRole('button', { name: '최동훈', exact: true }).click()
  await percentInput(page).fill('20')
  await assignButton(page).click()
  await expect(page.getByRole('alert')).toHaveText('투입 불가 직원은 새 배치를 받을 수 없습니다.')
  expect((await detailOf(request, ids.donghun)).assignments).toEqual(donghunBefore.assignments)

  // (e) release 박소영's assignment through the dialog: the row goes and the availability is what it was before (a).
  await currentRegion(page).locator('tbody tr', { hasText: '박소영' }).getByRole('button', { name: '해제' }).click()
  const dialog = page.getByRole('dialog', { name: '배치 해제' })
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: '해제' }).click()
  await expect(dialog).toHaveCount(0)
  await expect(currentRegion(page).locator('tbody tr', { hasText: '박소영' })).toHaveCount(0)
  const afterRelease = await expectCandidateMatchesApi(page, request, '박소영', ids.soyoung)
  expect(afterRelease).toBe(initialAvailability)
  expect((await detailOf(request, ids.soyoung)).assignments.filter((a) => a.projectName === '베타 프로젝트')).toEqual(
    before.assignments.filter((a) => a.projectName === '베타 프로젝트'),
  )
})
