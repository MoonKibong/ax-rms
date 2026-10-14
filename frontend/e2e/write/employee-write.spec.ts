import { expect, test, type APIRequestContext, type Locator, type Page } from '@playwright/test'
import { HR_MANAGER, PROJECT_MANAGER, loginAs } from '../support/auth'
import { settle } from '../support/layout'

// T#39 criterion 11: real saves on the per-run DB of `scripts/e2e-servers.sh --fresh-db` (.nexi-tmp/e2e-write.db, made
// for this run and removed after it). Each save is checked three ways: the screen after the save, the screen after
// page.reload(), and the API at the same moment. The tests run in order in one file: the rejected saves first (nothing
// changes), then registration, edit and status changes.

type Detail = {
  id: number
  name: string
  departmentId: number
  departmentName: string
  jobTitle: string
  careerYears: number
  availabilityStatus: 'AVAILABLE' | 'UNAVAILABLE'
  unavailableReason: string | null
  unavailableUntil: string | null
  currentAvailability: number
  needsReview: boolean
  skills: Array<{ skillName: string; proficiencyLevel: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED' }>
  assignments: Array<{ projectName: string; startDate: string; endDate: string; allocationPercent: number }>
  today: string
}

const LEVELS = { BEGINNER: '초급', INTERMEDIATE: '중급', ADVANCED: '고급' } as const
const STATUSES = { AVAILABLE: '투입 가능', UNAVAILABLE: '투입 불가' } as const
const DANGER = 'rgb(191, 43, 27)'
const NEW_NAME = 'T39 신규 직원'

const pathOf = (page: Page) => new URL(page.url()).pathname
const nameInput = (page: Page) => page.getByRole('textbox', { name: '이름', exact: true })
const departmentSelect = (page: Page) => page.getByRole('combobox', { name: '부서', exact: true })
const jobInput = (page: Page) => page.getByRole('textbox', { name: '직무', exact: true })
const careerInput = (page: Page) => page.getByRole('spinbutton', { name: '경력(년)', exact: true })
const button = (page: Page, name: string) => page.getByRole('button', { name, exact: true })
const dialog = (page: Page) => page.getByRole('dialog', { name: '상태 변경' })

test.describe.configure({ mode: 'serial' })

test.beforeAll(() => {
  // Never against the shared e2e DB: without the runner's mark this spec fails before sending anything.
  if (process.env.E2E_DB !== 'fresh') {
    throw new Error('write 스펙은 scripts/e2e-servers.sh --fresh-db로만 실행합니다 (E2E_DB=fresh 아님)')
  }
})

async function asHr(request: APIRequestContext): Promise<void> {
  const login = await request.post('/api/auth/login', {
    data: { username: HR_MANAGER.username, password: HR_MANAGER.password },
  })
  expect(login.status(), 'hr.manager login').toBe(200)
}

async function employees(request: APIRequestContext): Promise<Array<{ id: number; name: string }>> {
  const response = await request.get('/api/employees')
  expect(response.status(), 'GET /api/employees').toBe(200)
  return (await response.json()) as Array<{ id: number; name: string }>
}

async function idOf(request: APIRequestContext, name: string): Promise<number> {
  return (await employees(request)).find((employee) => employee.name === name)!.id
}

async function detailOf(request: APIRequestContext, id: number): Promise<Detail> {
  const response = await request.get(`/api/employees/${id}`)
  expect(response.status(), `GET /api/employees/${id}`).toBe(200)
  return (await response.json()) as Detail
}

function withoutToday(detail: Detail) {
  const { today, ...rest } = detail
  void today
  return rest
}

function plusDays(day: string, days: number): string {
  const date = new Date(`${day}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

async function open(page: Page, path: string): Promise<void> {
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto(path)
  await page.getByRole('navigation').first().waitFor()
  await page.waitForLoadState('networkidle')
  await settle(page)
}

// What the detail shows, as T#38's e2e reads it.
function viewOf(page: Page) {
  return page.locator('main').evaluate((main) => {
    const text = (element: Element | null) => (element?.textContent ?? '').trim()
    return {
      name: text(main.querySelector('h1[data-testid="employee-name"]')),
      badges: Array.from(main.querySelectorAll('.employee-detail .badge[data-status]')).map(text),
      info: Array.from(main.querySelectorAll('dl dd')).map(text),
      skills: Array.from(main.querySelectorAll('.employee-detail ul li')).map(text),
      rows: Array.from(main.querySelectorAll('tbody tr')).map((row) => Array.from(row.querySelectorAll('td')).map(text)),
    }
  })
}

function expectedView(detail: Detail) {
  return {
    name: detail.name,
    badges: [STATUSES[detail.availabilityStatus], ...(detail.needsReview ? ['확인 필요'] : [])],
    info: [
      detail.departmentName,
      detail.jobTitle,
      `${detail.careerYears}년`,
      detail.unavailableReason ?? '—',
      detail.unavailableUntil ?? '—',
    ],
    skills: detail.skills.map((skill) => `${skill.skillName} · ${LEVELS[skill.proficiencyLevel]}`),
    rows: detail.assignments.map((a) => [a.projectName, `${a.startDate} ~ ${a.endDate}`, `${a.allocationPercent}%`]),
  }
}

// The detail on the screen, after the save and after a reload, equals the API at the same moment.
async function expectScreenIsApi(page: Page, id: number): Promise<Detail> {
  await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible()
  const now = await detailOf(page.request, id)
  expect(await viewOf(page), 'the screen after the save').toEqual(expectedView(now))
  await page.reload()
  await page.waitForLoadState('networkidle')
  await expect(page.locator('h1[data-testid="employee-name"]')).toBeVisible()
  expect(await viewOf(page), 'the screen after a reload').toEqual(expectedView(await detailOf(page.request, id)))
  return now
}

// The list row of one employee: its status badge and 확인 필요 cell.
async function listRow(page: Page, name: string): Promise<{ status: string; review: string; href: string | null }> {
  await open(page, '/employees')
  return page.locator('tbody tr').evaluateAll(
    (rows, wanted) => {
      const row = rows.find((r) => r.querySelector('td')?.textContent?.trim() === wanted)!
      const cells = Array.from(row.querySelectorAll('td')).map((cell) => (cell.textContent ?? '').trim())
      return { status: cells[4], review: cells[6], href: row.querySelector('a')?.getAttribute('href') ?? null }
    },
    name,
  )
}

// BRIEF §7 Checks 6: the message right under the control (≤ 4px), on its left edge (±1), the control in danger.
async function expectMessageUnder(control: Locator, message: string): Promise<void> {
  await expect(control).toHaveAccessibleDescription(message)
  const measured = await control.evaluate((element) => {
    const shown = document.getElementById(element.getAttribute('aria-describedby') ?? '')!
    const c = element.getBoundingClientRect()
    const m = shown.getBoundingClientRect()
    return { gap: m.top - c.bottom, left: m.left - c.left, border: getComputedStyle(element).borderTopColor }
  })
  expect(measured.gap, `${message}: gap`).toBeGreaterThanOrEqual(0)
  expect(measured.gap, `${message}: gap`).toBeLessThanOrEqual(4)
  expect(Math.abs(measured.left), `${message}: left edge`).toBeLessThanOrEqual(1)
  expect(measured.border, `${message}: border`).toBe(DANGER)
}

async function saveExpecting(page: Page, method: string, status: number): Promise<void> {
  const answer = page.waitForResponse(
    (response) => response.request().method() === method && new URL(response.url()).pathname.startsWith('/api/employees'),
  )
  await button(page, '저장').click()
  expect((await answer).status(), `${method} answer`).toBe(status)
  await settle(page)
}

async function addSkill(page: Page, name: string, level: string | null): Promise<void> {
  await button(page, '기술 추가').click()
  const rows = page.getByRole('group', { name: /^기술 \d+$/ })
  const row = rows.nth((await rows.count()) - 1)
  await row.getByRole('textbox', { name: '기술 이름', exact: true }).fill(name)
  if (level) {
    await row.getByRole('combobox', { name: '숙련도', exact: true }).selectOption({ label: level })
  }
}

let parkAtStart: Detail
let parkId: number

test('starts from a freshly seeded DB of 20 employees', async ({ request }) => {
  await asHr(request)
  expect(await employees(request)).toHaveLength(20)
  parkId = await idOf(request, '박소영')
  parkAtStart = await detailOf(request, parkId)
})

test('rejected saves show the server message under its input and change nothing', async ({ page }) => {
  await loginAs(page, HR_MANAGER)
  await open(page, '/employees/new')
  expect(await nameInput(page).count(), 'the registration form').toBe(1)

  await saveExpecting(page, 'POST', 400)
  await expectMessageUnder(nameInput(page), '이름을 입력하세요.')

  await nameInput(page).fill('거부 확인')
  await jobInput(page).fill('QA')
  await careerInput(page).fill('3')
  await saveExpecting(page, 'POST', 400)
  await expectMessageUnder(departmentSelect(page), '부서를 찾을 수 없습니다.')

  await departmentSelect(page).selectOption({ label: '개발팀' })
  await addSkill(page, 'Java', null)
  await saveExpecting(page, 'POST', 400)
  const skills = page.getByRole('group', { name: '기술', exact: true })
  await expect(skills).toHaveAccessibleDescription('기술 이름과 숙련도를 올바르게 입력하세요.')
  await expect(skills.getByText('기술 이름과 숙련도를 올바르게 입력하세요.', { exact: true })).toBeVisible()

  await careerInput(page).fill('-1')
  await saveExpecting(page, 'POST', 400)
  await expectMessageUnder(careerInput(page), '경력은 0년 이상이어야 합니다.')

  await open(page, `/employees/${parkId}/edit`)
  await expect(nameInput(page)).toHaveValue('박소영')
  await jobInput(page).fill('')
  await saveExpecting(page, 'PUT', 400)
  await expectMessageUnder(jobInput(page), '직무를 입력하세요.')

  await open(page, `/employees/${parkId}`)
  await button(page, '상태 변경').click()
  await dialog(page).getByRole('combobox', { name: '상태', exact: true }).selectOption({ label: '투입 불가' })
  const answer = page.waitForResponse((response) => response.request().method() === 'PATCH')
  await dialog(page).getByRole('button', { name: '저장', exact: true }).click()
  expect((await answer).status(), 'PATCH answer').toBe(400)
  await settle(page)
  await expectMessageUnder(dialog(page).getByRole('textbox', { name: '사유', exact: true }), '투입 불가 사유를 입력하세요.')

  expect(await employees(page.request), 'employees after the rejected saves').toHaveLength(20)
  expect(withoutToday(await detailOf(page.request, parkId))).toEqual(withoutToday(parkAtStart))
})

test('project.manager cannot write employees (regression: T#6 rules)', async ({ playwright }, testInfo) => {
  const request = await playwright.request.newContext({ baseURL: testInfo.project.use.baseURL })
  const login = await request.post('/api/auth/login', {
    data: { username: PROJECT_MANAGER.username, password: PROJECT_MANAGER.password },
  })
  expect(login.status(), 'project.manager login').toBe(200)
  const valid = { name: '권한 확인', departmentId: parkAtStart.departmentId, jobTitle: 'QA', careerYears: 1, skills: [] }
  const writes = [
    await request.post('/api/employees', { data: valid }),
    await request.put(`/api/employees/${parkId}`, { data: { ...valid, name: '박소영' } }),
    await request.patch(`/api/employees/${parkId}/status`, {
      data: { availabilityStatus: 'UNAVAILABLE', unavailableReason: '권한 확인', unavailableUntil: null },
    }),
  ]
  for (const response of writes) {
    expect(response.status(), `${response.url()}`).toBe(403)
    expect(((await response.json()) as { code: string }).code).toBe('AUTH_FORBIDDEN')
  }
  await request.dispose()

  const hr = await playwright.request.newContext({ baseURL: testInfo.project.use.baseURL })
  await asHr(hr)
  expect(await employees(hr)).toHaveLength(20)
  expect(withoutToday(await detailOf(hr, parkId))).toEqual(withoutToday(parkAtStart))
  await hr.dispose()
})

test('registers a new employee: 201, its detail, a reload and the list agree with the API', async ({ page }) => {
  await loginAs(page, HR_MANAGER)
  await open(page, '/employees/new')
  expect(await nameInput(page).count(), 'the registration form').toBe(1)

  await nameInput(page).fill(NEW_NAME)
  await departmentSelect(page).selectOption({ label: '기획팀' })
  await jobInput(page).fill('QA 엔지니어')
  await addSkill(page, 'Java', '중급')
  await addSkill(page, 'React', '고급')
  await careerInput(page).fill('3')
  const answer = page.waitForResponse((response) => response.request().method() === 'POST')
  await button(page, '저장').click()
  const created = await answer
  expect(created.status(), 'POST answer').toBe(201)
  const id = ((await created.json()) as Detail).id
  await expect.poll(() => pathOf(page)).toBe(`/employees/${id}`)

  const saved = await expectScreenIsApi(page, id)
  expect(saved).toMatchObject({
    name: NEW_NAME,
    departmentName: '기획팀',
    jobTitle: 'QA 엔지니어',
    careerYears: 3,
    availabilityStatus: 'AVAILABLE',
    assignments: [],
    skills: [
      { skillName: 'Java', proficiencyLevel: 'INTERMEDIATE' },
      { skillName: 'React', proficiencyLevel: 'ADVANCED' },
    ],
  })
  expect(await employees(page.request)).toHaveLength(21)
  expect((await listRow(page, NEW_NAME)).href).toBe(`/employees/${id}`)
})

test('edits 박소영: 200, the detail and a reload agree with the API; status and assignments stay', async ({ page }) => {
  await loginAs(page, HR_MANAGER)
  await open(page, `/employees/${parkId}/edit`)
  await expect(nameInput(page)).toHaveValue('박소영')

  await jobInput(page).fill('시니어 백엔드 개발자')
  await careerInput(page).fill('6')
  await addSkill(page, 'Kubernetes', '초급')
  await saveExpecting(page, 'PUT', 200)
  await expect.poll(() => pathOf(page)).toBe(`/employees/${parkId}`)

  const saved = await expectScreenIsApi(page, parkId)
  expect(saved.jobTitle).toBe('시니어 백엔드 개발자')
  expect(saved.careerYears).toBe(6)
  expect(saved.skills).toEqual([
    { skillName: 'Java', proficiencyLevel: 'ADVANCED' },
    { skillName: 'Kubernetes', proficiencyLevel: 'BEGINNER' },
  ])
  expect(saved.assignments).toEqual(parkAtStart.assignments)
  expect(saved.availabilityStatus).toBe(parkAtStart.availabilityStatus)
})

test('marks 박소영 투입 불가: the dialog closes, the detail, a reload and the list agree with the API', async ({ page }) => {
  await loginAs(page, HR_MANAGER)
  await open(page, `/employees/${parkId}`)
  const until = plusDays((await detailOf(page.request, parkId)).today, 30)

  await button(page, '상태 변경').click()
  await dialog(page).getByRole('combobox', { name: '상태', exact: true }).selectOption({ label: '투입 불가' })
  await dialog(page).getByRole('textbox', { name: '사유', exact: true }).fill('교육')
  await dialog(page).getByLabel('종료 예정일').fill(until)
  const answer = page.waitForResponse((response) => response.request().method() === 'PATCH')
  await dialog(page).getByRole('button', { name: '저장', exact: true }).click()
  expect((await answer).status(), 'PATCH answer').toBe(200)
  await expect(dialog(page)).toHaveCount(0)

  const saved = await expectScreenIsApi(page, parkId)
  expect(saved).toMatchObject({ availabilityStatus: 'UNAVAILABLE', unavailableReason: '교육', unavailableUntil: until })
  // 알파 ends after today, so the server says 확인 필요 (D21).
  expect(saved.needsReview).toBe(true)
  expect(saved.assignments).toEqual(parkAtStart.assignments)
  const row = await listRow(page, '박소영')
  expect(row.status).toBe(STATUSES[saved.availabilityStatus])
  expect(row.review).toBe(saved.needsReview ? '확인 필요' : '—')
})

test('makes 박소영 투입 가능 again: no reason, no end date, no 확인 필요', async ({ page }) => {
  await loginAs(page, HR_MANAGER)
  await open(page, `/employees/${parkId}`)

  await button(page, '상태 변경').click()
  await dialog(page).getByRole('combobox', { name: '상태', exact: true }).selectOption({ label: '투입 가능' })
  const answer = page.waitForResponse((response) => response.request().method() === 'PATCH')
  await dialog(page).getByRole('button', { name: '저장', exact: true }).click()
  expect((await answer).status(), 'PATCH answer').toBe(200)
  await expect(dialog(page)).toHaveCount(0)

  const saved = await expectScreenIsApi(page, parkId)
  expect(saved).toMatchObject({ availabilityStatus: 'AVAILABLE', unavailableReason: null, unavailableUntil: null, needsReview: false })
  expect((await viewOf(page)).info.slice(3)).toEqual(['—', '—'])
})

test('makes 최동훈 투입 가능: 확인 필요 goes away (D21)', async ({ page }) => {
  await loginAs(page, HR_MANAGER)
  const choiId = await idOf(page.request, '최동훈')
  expect((await detailOf(page.request, choiId)).needsReview, '최동훈 before').toBe(true)
  await open(page, `/employees/${choiId}`)
  await expect(page.locator('main .badge[data-status="NEEDS_REVIEW"]')).toBeVisible()

  await button(page, '상태 변경').click()
  await dialog(page).getByRole('combobox', { name: '상태', exact: true }).selectOption({ label: '투입 가능' })
  const answer = page.waitForResponse((response) => response.request().method() === 'PATCH')
  await dialog(page).getByRole('button', { name: '저장', exact: true }).click()
  expect((await answer).status(), 'PATCH answer').toBe(200)

  const saved = await expectScreenIsApi(page, choiId)
  expect(saved.needsReview).toBe(false)
  await expect(page.locator('main .badge[data-status="NEEDS_REVIEW"]')).toHaveCount(0)
})
