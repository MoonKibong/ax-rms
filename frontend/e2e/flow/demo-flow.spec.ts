import { expect, test, type APIRequestContext, type Locator, type Page } from '@playwright/test'
import { addDays, assignButton, candidatesRegion, currentRegion, percentInput } from '../support/assign'
import { PROJECT_MANAGER } from '../support/auth'
import { region } from '../support/dashboard'
import { expectNoHorizontalOverflow, settle } from '../support/layout'

// T#19: the §10 demonstration flow (D10) from start to end, on the per-run DB of `scripts/e2e-servers.sh --fresh-db`
// (.nexi-tmp/e2e-write.db, seeded on this run: D31, D38), as project.manager at 1280px and then at 360px. After the one
// page.goto('/login') the test moves only through the menu and links, so every value after a save is one the screen asked
// for again (D36). Each value is the API's at the same moment and the seed's own number (contract "시드 값"). The 360px
// test runs after the 1280px one on the same DB: its step 1 finding the seed values again shows the release restored them.
type EmployeeDetail = {
  id: number
  name: string
  availabilityStatus: 'AVAILABLE' | 'UNAVAILABLE'
  currentAvailability: number
  today: string
  assignments: Array<{ projectName: string; startDate: string; endDate: string; allocationPercent: number }>
}
type ProjectDetail = {
  id: number
  name: string
  requiredHeadcount: number
  assignedHeadcount: number
  assignments: Array<{ employeeName: string; startDate: string; endDate: string; allocationPercent: number }>
}
type Dashboard = {
  employees: Array<{ id: number; name: string; currentAvailability: number }>
  departments: Array<{ id: number; name: string; averageAvailability: number }>
}

const PARK = '박소영'
const CHOI = '최동훈'
const BETA = '베타 프로젝트'
const DEV = '개발팀'
const OVER_ALLOCATED = '대상 기간에 투입률 합계가 100%를 초과합니다.'
const UNAVAILABLE = '투입 불가 직원은 새 배치를 받을 수 없습니다.'

// The seed's numbers (SeedRunner; checked in a temporary seeded DB when the contract was written).
const SEED = {
  employees: 20,
  projects: 5,
  departments: 3,
  parkAvailability: 40,
  parkAfterAssign: 10,
  devAverage: '70.6',
  devAfterAssign: '66.9',
  betaRequired: 2,
  betaAssigned: 3,
  betaNames: ['안유진', '임도윤', CHOI],
}

test.describe.configure({ mode: 'serial' })

test.beforeAll(() => {
  // Never against the shared e2e DB: without the runner's mark this spec fails before sending anything.
  if (process.env.E2E_DB !== 'fresh') {
    throw new Error('flow 스펙은 scripts/e2e-servers.sh --fresh-db로만 실행합니다 (E2E_DB=fresh 아님)')
  }
})

async function asProjectManager(request: APIRequestContext): Promise<void> {
  const login = await request.post('/api/auth/login', {
    data: { username: PROJECT_MANAGER.username, password: PROJECT_MANAGER.password },
  })
  expect(login.status(), 'project.manager login').toBe(200)
}

async function getJson<T>(request: APIRequestContext, path: string): Promise<T> {
  const response = await request.get(path)
  expect(response.status(), `GET ${path}`).toBe(200)
  return (await response.json()) as T
}

async function idOf(request: APIRequestContext, path: string, name: string): Promise<number> {
  const items = await getJson<Array<{ id: number; name: string }>>(request, path)
  return items.find((item) => item.name === name)!.id
}

const employeeOf = (request: APIRequestContext, id: number) => getJson<EmployeeDetail>(request, `/api/employees/${id}`)
const projectOf = (request: APIRequestContext, id: number) => getJson<ProjectDetail>(request, `/api/projects/${id}`)
const dashboardOf = (request: APIRequestContext) => getJson<Dashboard>(request, '/api/dashboard')

async function periodAvailability(request: APIRequestContext, projectId: number, start: string, end: string, employeeId: number): Promise<number> {
  const rows = await getJson<Array<{ employeeId: number; periodAvailability: number }>>(
    request,
    `/api/assignments/candidates?projectId=${projectId}&startDate=${start}&endDate=${end}`,
  )
  return rows.find((row) => row.employeeId === employeeId)!.periodAvailability
}

const betaAssignmentsOf = (employee: EmployeeDetail) => employee.assignments.filter((a) => a.projectName === BETA)

// --- screen helpers ---------------------------------------------------------------------------------------------------

const pathOf = (page: Page) => new URL(page.url()).pathname
const h1 = (page: Page, name: string) => page.getByRole('heading', { level: 1, name, exact: true })
// The row whose cell links to `name`. The inner locator comes from the page: `has` is matched inside each row.
const rowWithLink = (page: Page, scope: Page | Locator, name: string) =>
  scope.locator('tbody tr', { has: page.getByRole('link', { name, exact: true }) })
const cell = (row: Locator, index: number) => row.locator('td').nth(index)

async function menu(page: Page, name: '대시보드' | '직원' | '프로젝트'): Promise<void> {
  await page.getByRole('navigation', { name: '주 메뉴' }).getByRole('link', { name, exact: true }).click()
}

// The value of one item of a dashboard list, found by the name its link shows.
const dashboardValue = (page: Page, list: string, name: string) =>
  region(page, list)
    .getByRole('listitem')
    .filter({ has: page.getByRole('link', { name, exact: true }) })
    .locator('.dashboard-list__value')

async function expectFits(page: Page, width: number): Promise<void> {
  await settle(page)
  await expectNoHorizontalOverflow(page, [width])
}

// The dashboard as the screen shows it, equal to the API now and to the seed's numbers.
async function expectDashboard(page: Page, request: APIRequestContext, width: number, parkId: number, park: number, dev: string): Promise<void> {
  await expect(h1(page, '대시보드')).toBeVisible()
  const api = await dashboardOf(request)
  expect(api.employees.find((employee) => employee.id === parkId)!.currentAvailability, 'dashboard API: 박소영').toBe(park)
  expect(api.departments.find((department) => department.name === DEV)!.averageAvailability.toFixed(1), 'dashboard API: 개발팀').toBe(dev)
  await expect(dashboardValue(page, '직원별 가용률', PARK)).toHaveText(`${park}%`)
  await expect(dashboardValue(page, '부서별 평균 가용률', DEV)).toHaveText(`${dev}%`)
  await expectFits(page, width)
}

// The employee list: every employee of the API, 박소영's status and current availability.
async function expectEmployeeList(page: Page, request: APIRequestContext, width: number, park: number): Promise<void> {
  await expect(h1(page, '직원')).toBeVisible()
  const api = await getJson<Array<{ name: string; availabilityStatus: string; currentAvailability: number }>>(request, '/api/employees')
  expect(api).toHaveLength(SEED.employees)
  expect(api.find((employee) => employee.name === PARK)!.currentAvailability, 'employees API: 박소영').toBe(park)
  await expect(page.locator('tbody tr')).toHaveCount(SEED.employees)
  await expect(cell(rowWithLink(page, page, PARK), 4)).toHaveText('투입 가능')
  await expect(cell(rowWithLink(page, page, PARK), 5)).toHaveText(`${park}%`)
  await expect(cell(rowWithLink(page, page, CHOI), 4)).toHaveText('투입 불가')
  await expectFits(page, width)
}

// The project list: five projects and the beta project's assigned headcount.
async function expectProjectList(page: Page, request: APIRequestContext, width: number, betaId: number, assigned: number): Promise<void> {
  await expect(h1(page, '프로젝트')).toBeVisible()
  const api = await getJson<Array<{ id: number; assignedHeadcount: number }>>(request, '/api/projects')
  expect(api).toHaveLength(SEED.projects)
  expect(api.find((project) => project.id === betaId)!.assignedHeadcount, 'projects API: 베타 배치 인원').toBe(assigned)
  await expect(page.locator('tbody tr')).toHaveCount(SEED.projects)
  await expect(cell(rowWithLink(page, page, BETA), 4)).toHaveText(String(assigned))
  await expectFits(page, width)
}

// The beta project's detail: its headcount line and the rows of 배치 인력, in the API's order.
async function expectBetaDetail(page: Page, request: APIRequestContext, width: number, betaId: number, names: string[]): Promise<void> {
  await expect(h1(page, BETA)).toBeVisible()
  const api = await projectOf(request, betaId)
  expect(api.assignments.map((a) => a.employeeName), 'project API: 배치 인력').toEqual(names)
  expect(api.assignedHeadcount).toBe(names.length)
  await expect(page.getByText(`필요 ${SEED.betaRequired}명 / 배치 ${names.length}명`, { exact: true })).toBeVisible()
  const assigned = page.getByRole('region', { name: '배치 인력' })
  await expect(assigned.locator('tbody tr')).toHaveCount(names.length)
  for (const [index, name] of names.entries()) {
    await expect(cell(assigned.locator('tbody tr').nth(index), 0)).toHaveText(name)
  }
  await expectFits(page, width)
}

// 박소영's detail: the current availability and whether the beta assignment is in 배치 현황.
async function expectParkDetail(page: Page, request: APIRequestContext, width: number, parkId: number, park: number, beta: string | null): Promise<void> {
  await expect(page.getByTestId('employee-name')).toHaveText(PARK)
  expect(pathOf(page)).toBe(`/employees/${parkId}`)
  const api = await employeeOf(request, parkId)
  expect(api.currentAvailability, 'employee API: 박소영').toBe(park)
  await expect(page.getByTestId('current-availability')).toHaveText(`${park}%`)
  const schedule = page.locator('section', { has: page.getByRole('heading', { level: 2, name: '배치 현황' }) })
  const betaRow = schedule.locator('tbody tr', { has: page.locator('td', { hasText: BETA }) })
  if (beta === null) {
    await expect(betaRow).toHaveCount(0)
  } else {
    await expect(betaRow).toHaveCount(1)
    await expect(cell(betaRow, 1)).toHaveText(beta)
    await expect(cell(betaRow, 2)).toHaveText('30%')
  }
  await expectFits(page, width)
}

// Sets the period of the assignment screen and waits for the candidates of that period.
async function setPeriod(page: Page, start: string, end: string): Promise<void> {
  const answered = page.waitForResponse(
    (response) => response.url().includes('/api/assignments/candidates') && response.url().includes(`startDate=${start}`) && response.url().includes(`endDate=${end}`),
  )
  await page.getByLabel('시작일').fill(start)
  await page.getByLabel('종료일').fill(end)
  await answered
  await settle(page)
}

const candidateRow = (page: Page, name: string) =>
  candidatesRegion(page).locator('tbody tr', { has: page.getByRole('button', { name, exact: true }) })

async function openBetaAssign(page: Page, width: number): Promise<void> {
  const link = page.getByRole('link', { name: '인력 배치', exact: true })
  await expect(link, '인력 배치 is shown at this width (D29)').toBeVisible()
  await link.click()
  await expect(candidatesRegion(page)).toBeVisible()
  await expect(h1(page, BETA)).toBeVisible()
  await expect(currentRegion(page).locator('tbody tr').first()).toBeVisible()
  await expectFits(page, width)
}

// --- the tests --------------------------------------------------------------------------------------------------------

test('새 DB와 시드에서 시작한다', async ({ request }) => {
  await asProjectManager(request)
  expect(await getJson<unknown[]>(request, '/api/employees')).toHaveLength(SEED.employees)
  expect(await getJson<unknown[]>(request, '/api/projects')).toHaveLength(SEED.projects)
  expect(await getJson<unknown[]>(request, '/api/departments')).toHaveLength(SEED.departments)
  const park = await employeeOf(request, await idOf(request, '/api/employees', PARK))
  expect(park.availabilityStatus).toBe('AVAILABLE')
  expect(park.currentAvailability).toBe(SEED.parkAvailability)
  const choi = await employeeOf(request, await idOf(request, '/api/employees', CHOI))
  expect(choi.availabilityStatus).toBe('UNAVAILABLE')
})

for (const width of [1280, 360]) {
  test(`§10 흐름 ${width}px`, async ({ page, request }) => {
    await asProjectManager(request)
    const parkId = await idOf(request, '/api/employees', PARK)
    const choiId = await idOf(request, '/api/employees', CHOI)
    const betaId = await idOf(request, '/api/projects', BETA)
    const parkAtStart = await employeeOf(request, parkId)
    const choiAtStart = await employeeOf(request, choiId)
    const today = parkAtStart.today
    const alpha = parkAtStart.assignments.find((a) => a.projectName === '알파 프로젝트')!
    const assignStart = today
    const assignEnd = addDays(today, 30)
    const overStart = addDays(today, 31)
    const overEnd = addDays(today, 40)
    const assignedPeriod = `${assignStart} ~ ${assignEnd}`
    expect(betaAssignmentsOf(parkAtStart), '박소영 starts without a beta assignment').toEqual([])

    // 1 조회: log in on the login form, then the dashboard, the employee list, the project list and the beta detail.
    await page.setViewportSize({ width, height: 800 })
    await page.goto('/login')
    await page.getByLabel('계정', { exact: true }).fill(PROJECT_MANAGER.username)
    await page.getByLabel('비밀번호', { exact: true }).fill(PROJECT_MANAGER.password)
    await expectFits(page, width)
    await page.getByRole('button', { name: '로그인', exact: true }).click()
    await expect.poll(() => pathOf(page)).toBe('/')
    await expectDashboard(page, request, width, parkId, SEED.parkAvailability, SEED.devAverage)
    await menu(page, '직원')
    await expectEmployeeList(page, request, width, SEED.parkAvailability)
    await menu(page, '프로젝트')
    await expectProjectList(page, request, width, betaId, SEED.betaAssigned)
    await page.getByRole('link', { name: BETA, exact: true }).click()
    await expectBetaDetail(page, request, width, betaId, SEED.betaNames)

    // 2 선택: the assignment screen, the period, and 박소영 among the candidates.
    await openBetaAssign(page, width)
    await setPeriod(page, assignStart, assignEnd)
    expect(await periodAvailability(request, betaId, assignStart, assignEnd, parkId)).toBe(SEED.parkAvailability)
    await expect(cell(candidateRow(page, PARK), 3)).toHaveText('투입 가능')
    await expect(cell(candidateRow(page, PARK), 4)).toHaveText(`${SEED.parkAvailability}%`)
    const parkButton = candidatesRegion(page).getByRole('button', { name: PARK, exact: true })
    await expect(parkButton).toBeVisible()
    await parkButton.click()
    await expect(parkButton).toHaveAttribute('aria-pressed', 'true')
    const schedule = page.getByRole('region', { name: '선택한 직원 일정' })
    await expect(schedule.getByRole('img', { name: `알파 프로젝트, ${alpha.startDate} ~ ${alpha.endDate}, 60%`, exact: true })).toBeVisible()
    await expectFits(page, width)

    // 3 배치: 30% for the period (§7 정상 배치: 60% + 30% = 90%, availability 10%).
    await percentInput(page).fill('30')
    await assignButton(page).click()
    const parkCurrent = rowWithLink(page, currentRegion(page), PARK)
    await expect(cell(parkCurrent, 2)).toHaveText('30%')
    await expect(cell(parkCurrent, 1)).toHaveText(assignedPeriod)
    await expect(percentInput(page)).toHaveValue('')
    await expect(cell(candidateRow(page, PARK), 4)).toHaveText(`${SEED.parkAfterAssign}%`)
    expect(await periodAvailability(request, betaId, assignStart, assignEnd, parkId)).toBe(SEED.parkAfterAssign)
    await expect(schedule.getByRole('img', { name: `${assignStart} ~ ${assignEnd}, 합계 90%`, exact: true })).toBeVisible()
    const parkAssigned = await employeeOf(request, parkId)
    expect(betaAssignmentsOf(parkAssigned).map(({ startDate, endDate, allocationPercent }) => ({ startDate, endDate, allocationPercent }))).toEqual([
      { startDate: assignStart, endDate: assignEnd, allocationPercent: 30 },
    ])
    await expectFits(page, width)

    // 4 갱신: the employee detail and list, the project list and detail, and the dashboard show the values asked for again.
    await currentRegion(page).getByRole('link', { name: PARK, exact: true }).click()
    await expectParkDetail(page, request, width, parkId, SEED.parkAfterAssign, assignedPeriod)
    await menu(page, '직원')
    await expectEmployeeList(page, request, width, SEED.parkAfterAssign)
    await menu(page, '프로젝트')
    await expectProjectList(page, request, width, betaId, SEED.betaAssigned + 1)
    await page.getByRole('link', { name: BETA, exact: true }).click()
    await expectBetaDetail(page, request, width, betaId, [...SEED.betaNames, PARK])
    await expect(cell(rowWithLink(page, page.getByRole('region', { name: '배치 인력' }), PARK), 2)).toHaveText('30%')
    await menu(page, '대시보드')
    await expectDashboard(page, request, width, parkId, SEED.parkAfterAssign, SEED.devAfterAssign)

    // 5 100% 초과 차단: 박소영 has only the alpha 60% after the beta assignment ends; 50% more is 110% (§7 투입률 초과).
    await menu(page, '프로젝트')
    await page.getByRole('link', { name: BETA, exact: true }).click()
    await expect(h1(page, BETA)).toBeVisible()
    await openBetaAssign(page, width)
    await setPeriod(page, overStart, overEnd)
    await expect(cell(candidateRow(page, PARK), 4)).toHaveText(`${SEED.parkAvailability}%`)
    await candidatesRegion(page).getByRole('button', { name: PARK, exact: true }).click()
    await percentInput(page).fill('50')
    await assignButton(page).click()
    const overMessage = page.locator('.field__error', { hasText: OVER_ALLOCATED })
    await expect(overMessage).toBeVisible()
    await expect(percentInput(page)).toHaveAttribute('aria-invalid', 'true')
    const inputBox = (await percentInput(page).boundingBox())!
    const messageBox = (await overMessage.boundingBox())!
    const gap = messageBox.y - (inputBox.y + inputBox.height)
    expect(gap, 'the cause is right under 투입률(%)').toBeGreaterThanOrEqual(0)
    expect(gap, 'the cause is right under 투입률(%)').toBeLessThanOrEqual(4)
    expect(await employeeOf(request, parkId).then((employee) => employee.assignments)).toEqual(parkAssigned.assignments)
    await expectFits(page, width)

    // 6 투입 불가 차단: 최동훈 is unavailable; nothing is saved.
    await expect(cell(candidateRow(page, CHOI), 3)).toHaveText('투입 불가')
    await candidatesRegion(page).getByRole('button', { name: CHOI, exact: true }).click()
    await percentInput(page).fill('20')
    await assignButton(page).click()
    const alert = page.getByRole('alert')
    await expect(alert).toHaveText(UNAVAILABLE)
    const alertBox = (await alert.boundingBox())!
    const buttonBox = (await assignButton(page).boundingBox())!
    expect(alertBox.y + alertBox.height, 'the cause is above 배치').toBeLessThanOrEqual(buttonBox.y)
    expect((await employeeOf(request, choiId)).assignments).toEqual(choiAtStart.assignments)
    await expectFits(page, width)

    // 7 해제 후 복구: release through the dialog; every screen shows step 1's values again.
    const release = rowWithLink(page, currentRegion(page), PARK).getByRole('button', { name: '해제', exact: true })
    await expect(release).toBeVisible()
    await release.click()
    const dialog = page.getByRole('dialog', { name: '배치 해제' })
    await expect(dialog).toBeVisible()
    await expectFits(page, width)
    await dialog.getByRole('button', { name: '해제', exact: true }).click()
    await expect(dialog).toHaveCount(0)
    await expect(rowWithLink(page, currentRegion(page), PARK)).toHaveCount(0)
    await menu(page, '직원')
    await expectEmployeeList(page, request, width, SEED.parkAvailability)
    await page.getByRole('link', { name: PARK, exact: true }).click()
    await expectParkDetail(page, request, width, parkId, SEED.parkAvailability, null)
    await menu(page, '프로젝트')
    await expectProjectList(page, request, width, betaId, SEED.betaAssigned)
    await page.getByRole('link', { name: BETA, exact: true }).click()
    await expectBetaDetail(page, request, width, betaId, SEED.betaNames)
    await menu(page, '대시보드')
    await expectDashboard(page, request, width, parkId, SEED.parkAvailability, SEED.devAverage)
    expect((await employeeOf(request, parkId)).assignments).toEqual(parkAtStart.assignments)
  })
}
