import { expect, test, type APIRequestContext, type Locator, type Page } from '@playwright/test'
import { HR_MANAGER, PROJECT_MANAGER, loginAs } from '../support/auth'
import { settle } from '../support/layout'

// T#34 criterion 7: real project saves on the per-run DB of `scripts/e2e-servers.sh --fresh-db` (.nexi-tmp/e2e-write.db,
// made for this run and removed after it). Each save is checked three ways: the screen after the save, the screen after
// page.reload(), and the API at the same moment. The tests run in order in one file: the rejected saves first (nothing
// changes), then registration and edit of the project this spec registers. Seed projects are never changed, and no
// employee data is asserted, so this spec holds before or after write/employee-write.spec.ts.

type Detail = {
  id: number
  name: string
  description: string | null
  startDate: string
  endDate: string
  status: 'PLANNED' | 'IN_PROGRESS' | 'DONE' | 'ON_HOLD'
  requiredSkills: Array<{
    jobTitle: string
    skillName: string
    proficiencyLevel: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED'
    headcount: number
  }>
  requiredHeadcount: number
  assignedHeadcount: number
  assignments: Array<{ employeeName: string; startDate: string; endDate: string }>
}

const LEVELS = { BEGINNER: '초급', INTERMEDIATE: '중급', ADVANCED: '고급' } as const
const STATUSES = { PLANNED: '계획', IN_PROGRESS: '진행 중', DONE: '완료', ON_HOLD: '보류' } as const
const DANGER = 'rgb(191, 43, 27)'
const ALPHA = '알파 프로젝트'
const NEW_NAME = 'T34 신규 프로젝트'
const EDITED_NAME = 'T34 수정 프로젝트'

const pathOf = (page: Page) => new URL(page.url()).pathname
const nameInput = (page: Page) => page.getByRole('textbox', { name: '프로젝트명', exact: true })
const descriptionInput = (page: Page) => page.getByRole('textbox', { name: '설명', exact: true })
const startInput = (page: Page) => page.getByLabel('시작일')
const endInput = (page: Page) => page.getByLabel('종료일')
const statusSelect = (page: Page) => page.getByRole('combobox', { name: '상태', exact: true })
const row = (page: Page, n: number) => page.getByRole('group', { name: `필요 역량 ${n}`, exact: true })
const button = (page: Page, name: string) => page.getByRole('button', { name, exact: true })

test.describe.configure({ mode: 'serial' })

test.beforeAll(() => {
  // Never against the shared e2e DB: without the runner's mark this spec fails before sending anything.
  if (process.env.E2E_DB !== 'fresh') {
    throw new Error('write 스펙은 scripts/e2e-servers.sh --fresh-db로만 실행합니다 (E2E_DB=fresh 아님)')
  }
})

async function projects(request: APIRequestContext): Promise<Array<{ id: number; name: string }>> {
  const response = await request.get('/api/projects')
  expect(response.status(), 'GET /api/projects').toBe(200)
  return (await response.json()) as Array<{ id: number; name: string }>
}

async function detailOf(request: APIRequestContext, id: number): Promise<Detail> {
  const response = await request.get(`/api/projects/${id}`)
  expect(response.status(), `GET /api/projects/${id}`).toBe(200)
  return (await response.json()) as Detail
}

async function alphaOf(request: APIRequestContext): Promise<Detail> {
  return detailOf(request, (await projects(request)).find((project) => project.name === ALPHA)!.id)
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

// Presses 저장 and returns the server's real answer to that save.
async function saveAndAnswer(page: Page, method: 'POST' | 'PUT') {
  const answer = page.waitForResponse(
    (response) => response.request().method() === method && new URL(response.url()).pathname.startsWith('/api/projects'),
  )
  await button(page, '저장').click()
  const response = await answer
  return { status: response.status(), body: (await response.json()) as { code?: string; message?: string; id?: number } }
}

// The message right under its input(s) (BRIEF 7 Checks 6): within 4px of the lowest one, on the first one's left edge,
// and, when asked, every input with the danger border.
async function expectUnder(page: Page, inputs: Locator[], message: string, border: boolean): Promise<void> {
  const shown = page.getByText(message, { exact: true })
  await expect(shown, message).toBeVisible()
  await settle(page)
  const boxes = await Promise.all(inputs.map((input) => input.boundingBox()))
  const box = (await shown.boundingBox())!
  const bottom = Math.max(...boxes.map((b) => b!.y + b!.height))
  expect(box.y - bottom, `${message}: gap`).toBeGreaterThanOrEqual(0)
  expect(box.y - bottom, `${message}: gap`).toBeLessThanOrEqual(4)
  expect(Math.abs(box.x - boxes[0]!.x), `${message}: left edge`).toBeLessThanOrEqual(1)
  if (border) {
    for (const input of inputs) {
      expect(await input.evaluate((element) => getComputedStyle(element).borderTopColor), `${message}: border`).toBe(DANGER)
    }
  }
}

async function addRow(page: Page, jobTitle: string, skillName: string, level: string, headcount: string): Promise<void> {
  await button(page, '필요 역량 추가').click()
  const n = await page.getByRole('group', { name: /^필요 역량 \d+$/ }).count()
  const added = row(page, n)
  await added.getByRole('textbox', { name: '직무', exact: true }).fill(jobTitle)
  await added.getByRole('textbox', { name: '기술', exact: true }).fill(skillName)
  if (level) {
    await added.getByRole('combobox', { name: '숙련도', exact: true }).selectOption({ label: level })
  }
  await added.getByRole('spinbutton', { name: '인원', exact: true }).fill(headcount)
}

// What the project detail (T#16) shows. Spaces are compared as plain spaces: the period keeps "~" on the start date's
// line with a no-break space (BRIEF §5).
function viewOf(page: Page) {
  return page.locator('main').evaluate((main) => {
    const text = (element: Element | null) => (element?.textContent ?? '').replace(/\s+/g, ' ').trim()
    const skills = main.querySelector('section[aria-labelledby="project-detail-skills"]')
    return {
      name: text(main.querySelector('h1')),
      status: text(main.querySelector('.project-detail__title .badge')),
      period: text(main.querySelector('.project-detail__period')),
      description: text(main.querySelector('.project-detail__description')),
      headcount: text(main.querySelector('.project-detail__headcount')),
      skills: Array.from(skills?.querySelectorAll('tbody tr') ?? []).map((tr) =>
        Array.from(tr.querySelectorAll('td')).map(text),
      ),
    }
  })
}

function expectedView(detail: Detail) {
  return {
    name: detail.name,
    status: STATUSES[detail.status],
    period: `${detail.startDate} ~ ${detail.endDate}`,
    description: detail.description ?? '—',
    headcount: `필요 ${detail.requiredHeadcount}명 / 배치 ${detail.assignedHeadcount}명`,
    skills: detail.requiredSkills.map((line) => [
      line.jobTitle,
      line.skillName,
      LEVELS[line.proficiencyLevel],
      String(line.headcount),
    ]),
  }
}

// The detail on the screen, after the save and after a reload, equals the API at the same moment.
async function expectScreenIsApi(page: Page, id: number): Promise<Detail> {
  await expect(page.getByRole('region', { name: '필요 역량' })).toBeVisible()
  const now = await detailOf(page.request, id)
  expect(await viewOf(page), 'the screen after the save').toEqual(expectedView(now))
  await page.reload()
  await page.waitForLoadState('networkidle')
  await expect(page.getByRole('region', { name: '필요 역량' })).toBeVisible()
  expect(await viewOf(page), 'the screen after a reload').toEqual(expectedView(await detailOf(page.request, id)))
  return now
}

let createdId = 0

test('starts from a freshly seeded DB of 5 projects', async ({ page }) => {
  await loginAs(page, PROJECT_MANAGER)
  expect((await projects(page.request)).length).toBe(5)
})

test('rejected saves show the server cause under its input and change nothing (D30, D33)', async ({ page }) => {
  await loginAs(page, PROJECT_MANAGER)
  const count = (await projects(page.request)).length
  const alphaBefore = await alphaOf(page.request)

  await open(page, '/projects/new')
  expect(await nameInput(page).count(), 'the registration form').toBe(1)

  let answer = await saveAndAnswer(page, 'POST')
  expect([answer.status, answer.body.code]).toEqual([400, 'PROJECT_NAME_REQUIRED'])
  await expectUnder(page, [nameInput(page)], '프로젝트명을 입력하세요.', true)

  await nameInput(page).fill(NEW_NAME)
  answer = await saveAndAnswer(page, 'POST')
  expect([answer.status, answer.body.code]).toEqual([400, 'PROJECT_PERIOD_REQUIRED'])
  await expectUnder(page, [startInput(page), endInput(page)], '시작일과 종료일을 YYYY-MM-DD 형식으로 입력하세요.', true)

  await startInput(page).fill('2030-06-30')
  await endInput(page).fill('2030-01-01')
  answer = await saveAndAnswer(page, 'POST')
  expect([answer.status, answer.body.code]).toEqual([400, 'PROJECT_PERIOD_INVALID'])
  await expectUnder(page, [startInput(page), endInput(page)], '종료일은 시작일보다 앞설 수 없습니다.', true)

  await startInput(page).fill('2030-01-01')
  await endInput(page).fill('2030-06-30')
  answer = await saveAndAnswer(page, 'POST')
  expect([answer.status, answer.body.code]).toEqual([400, 'PROJECT_STATUS_INVALID'])
  await expectUnder(page, [statusSelect(page)], '프로젝트 상태를 선택하세요.', true)

  await statusSelect(page).selectOption({ label: '계획' })
  await addRow(page, '백엔드 개발자', '', '', '')
  answer = await saveAndAnswer(page, 'POST')
  expect([answer.status, answer.body.code]).toEqual([400, 'PROJECT_SKILL_LINE_INVALID'])
  await expectUnder(
    page,
    [row(page, 1).getByRole('textbox', { name: '직무', exact: true })],
    '필요 역량의 직무, 기술, 숙련도, 인원(1 이상)을 모두 입력하세요.',
    false,
  )

  // D30: the end of 알파 moves to the day before its latest assignment ends, so exactly that assignment falls outside.
  const latest = [...alphaBefore.assignments].sort((a, b) => a.endDate.localeCompare(b.endDate)).at(-1)!
  await open(page, `/projects/${alphaBefore.id}/edit`)
  await expect(nameInput(page)).toHaveValue(ALPHA)
  await endInput(page).fill(plusDays(latest.endDate, -1))
  answer = await saveAndAnswer(page, 'PUT')
  expect([answer.status, answer.body.code]).toEqual([400, 'PROJECT_PERIOD_EXCLUDES_ASSIGNMENTS'])
  expect(answer.body.message).toContain('1건')
  expect(answer.body.message).toContain(latest.employeeName)
  await expectUnder(page, [startInput(page), endInput(page)], answer.body.message!, true)
  expect(pathOf(page)).toBe(`/projects/${alphaBefore.id}/edit`)

  expect((await projects(page.request)).length, 'projects after the rejected saves').toBe(count)
  expect(await alphaOf(page.request), '알파 after the rejected saves').toEqual(alphaBefore)
})

test('hr.manager cannot write projects (regression, T#6)', async ({ page }) => {
  await loginAs(page, HR_MANAGER)
  const count = (await projects(page.request)).length
  const alphaBefore = await alphaOf(page.request)
  const body = {
    name: 'T34 권한 검사',
    description: null,
    startDate: '2030-01-01',
    endDate: '2030-06-30',
    status: 'PLANNED',
    requiredSkills: [],
  }

  const created = await page.request.post('/api/projects', { data: body })
  const edited = await page.request.put(`/api/projects/${alphaBefore.id}`, { data: body })

  for (const [label, response] of [
    ['POST /api/projects', created],
    [`PUT /api/projects/${alphaBefore.id}`, edited],
  ] as const) {
    expect(response.status(), label).toBe(403)
    expect(((await response.json()) as { code: string }).code, label).toBe('AUTH_FORBIDDEN')
  }
  expect((await projects(page.request)).length).toBe(count)
  expect(await alphaOf(page.request)).toEqual(alphaBefore)
})

test('registers a project: the detail, a reload and the API agree, and the list links it', async ({ page }) => {
  await loginAs(page, PROJECT_MANAGER)
  const count = (await projects(page.request)).length
  await open(page, '/projects/new')
  expect(await nameInput(page).count(), 'the registration form').toBe(1)

  await nameInput(page).fill(NEW_NAME)
  await descriptionInput(page).fill('T34 설명')
  await startInput(page).fill('2030-01-01')
  await endInput(page).fill('2030-06-30')
  await statusSelect(page).selectOption({ label: '계획' })
  await addRow(page, '백엔드 개발자', 'Java', '고급', '2')
  await addRow(page, '디자이너', 'Figma', '초급', '1')
  const answer = await saveAndAnswer(page, 'POST')
  expect(answer.status).toBe(201)
  createdId = answer.body.id!
  await expect.poll(() => pathOf(page)).toBe(`/projects/${createdId}`)

  const saved = await expectScreenIsApi(page, createdId)
  expect(saved).toMatchObject({
    name: NEW_NAME,
    description: 'T34 설명',
    startDate: '2030-01-01',
    endDate: '2030-06-30',
    status: 'PLANNED',
    requiredSkills: [
      { jobTitle: '백엔드 개발자', skillName: 'Java', proficiencyLevel: 'ADVANCED', headcount: 2 },
      { jobTitle: '디자이너', skillName: 'Figma', proficiencyLevel: 'BEGINNER', headcount: 1 },
    ],
    requiredHeadcount: 3,
    assignedHeadcount: 0,
    assignments: [],
  })
  expect((await projects(page.request)).length).toBe(count + 1)

  await open(page, '/projects')
  await expect(page.getByRole('link', { name: NEW_NAME, exact: true })).toHaveAttribute('href', `/projects/${createdId}`)
})

test('edits the registered project: name, description, period, status and the required-skill rows', async ({ page }) => {
  expect(createdId, 'the project registered by the test before').toBeGreaterThan(0)
  await loginAs(page, PROJECT_MANAGER)
  await open(page, `/projects/${createdId}/edit`)
  await expect(nameInput(page)).toHaveValue(NEW_NAME)

  await nameInput(page).fill(EDITED_NAME)
  await descriptionInput(page).fill('')
  await endInput(page).fill('2030-12-31')
  await statusSelect(page).selectOption({ label: '진행 중' })
  await button(page, '필요 역량 1 삭제').click()
  await row(page, 1).getByRole('spinbutton', { name: '인원', exact: true }).fill('2')
  await addRow(page, '기획자', '기획', '중급', '1')
  const answer = await saveAndAnswer(page, 'PUT')
  expect(answer.status).toBe(200)
  await expect.poll(() => pathOf(page)).toBe(`/projects/${createdId}`)

  const saved = await expectScreenIsApi(page, createdId)
  expect(saved).toMatchObject({
    name: EDITED_NAME,
    description: null,
    startDate: '2030-01-01',
    endDate: '2030-12-31',
    status: 'IN_PROGRESS',
    requiredSkills: [
      { jobTitle: '디자이너', skillName: 'Figma', proficiencyLevel: 'BEGINNER', headcount: 2 },
      { jobTitle: '기획자', skillName: '기획', proficiencyLevel: 'INTERMEDIATE', headcount: 1 },
    ],
    requiredHeadcount: 3,
    assignments: [],
  })
  expect(await viewOf(page)).toMatchObject({ description: '—', status: '진행 중' })
})
