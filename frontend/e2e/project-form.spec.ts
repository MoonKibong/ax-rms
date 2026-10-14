import { expect, test, type APIRequestContext, type Locator, type Page } from '@playwright/test'
import { DUAL_MANAGER, EMPLOYEE_ONLY, HR_MANAGER, PROJECT_MANAGER, loginAs, type DemoAccount } from './support/auth'
import { expectNoHorizontalOverflow, settle } from './support/layout'
import { LONG_NAME, json } from './support/projects'

// T#34 criteria 4–6 on the shared e2e DB (backend/data/e2e.db): the form addresses by role and width, the desktop notice
// below 1024px, and the look of the form. No project write leaves the browser: every POST/PUT /api/projects… is answered
// by page.route (catchWrites), and the spec compares the shared DB at its start and its end. Seed dates depend on the
// day the shared DB was seeded, so they are read from the API, never written here.

type Detail = {
  id: number
  name: string
  description: string | null
  startDate: string
  endDate: string
  status: string
  requiredSkills: Array<{ jobTitle: string; skillName: string; proficiencyLevel: string; headcount: number }>
  assignments: Array<{ employeeName: string; startDate: string; endDate: string }>
  [key: string]: unknown
}

const FIXED_ID = 9001
const DANGER = 'rgb(191, 43, 27)'
const NOTICE = '데스크톱에서 이용해 주세요'
const ALPHA = '알파 프로젝트'

const pathOf = (page: Page) => new URL(page.url()).pathname
const title = (page: Page, name: string) => page.getByRole('heading', { level: 1, name, exact: true })
const nameInput = (page: Page) => page.getByRole('textbox', { name: '프로젝트명', exact: true })
const startInput = (page: Page) => page.getByLabel('시작일')
const endInput = (page: Page) => page.getByLabel('종료일')
const statusSelect = (page: Page) => page.getByRole('combobox', { name: '상태', exact: true })
const button = (page: Page, name: string) => page.getByRole('button', { name, exact: true })
const link = (page: Page, name: string) => page.getByRole('link', { name, exact: true })

async function asProjectManager(request: APIRequestContext): Promise<void> {
  const login = await request.post('/api/auth/login', {
    data: { username: PROJECT_MANAGER.username, password: PROJECT_MANAGER.password },
  })
  expect(login.status(), 'project.manager login').toBe(200)
}

async function alphaId(request: APIRequestContext): Promise<number> {
  await asProjectManager(request)
  const response = await request.get('/api/projects')
  expect(response.status(), 'GET /api/projects').toBe(200)
  const list = (await response.json()) as Array<{ id: number; name: string }>
  return list.find((project) => project.name === ALPHA)!.id
}

async function alphaDetail(request: APIRequestContext): Promise<Detail> {
  const id = await alphaId(request)
  const response = await request.get(`/api/projects/${id}`)
  expect(response.status(), `GET /api/projects/${id}`).toBe(200)
  return (await response.json()) as Detail
}

// What the shared DB holds for this spec's comparison: the project list and the detail of 알파 프로젝트.
async function sharedState(request: APIRequestContext) {
  await asProjectManager(request)
  const list = (await (await request.get('/api/projects')).json()) as unknown[]
  return { list, alpha: await alphaDetail(request) }
}

// Answers every project write in the browser, so nothing reaches the shared DB. Registered first in each test, so a
// test's own page.route (registered later) answers before it; GETs fall through to the server.
async function catchWrites(page: Page): Promise<string[]> {
  const caught: string[] = []
  await page.route(
    (url) => url.pathname.startsWith('/api/projects'),
    (route) => {
      const method = route.request().method()
      if (method === 'GET') {
        return route.fallback()
      }
      caught.push(`${method} ${new URL(route.request().url()).pathname}`)
      return json(route, { code: 'E2E_NO_WRITE', message: '공유 DB에는 쓰지 않습니다.' }, 400)
    },
  )
  return caught
}

async function open(page: Page, width: number, path: string): Promise<void> {
  await page.setViewportSize({ width, height: 800 })
  await page.goto(path)
  // The app first asks who is logged in (GET /api/auth/me); the shell, with its navigation, comes after that.
  await page.getByRole('navigation').first().waitFor()
  await page.waitForLoadState('networkidle')
  await settle(page)
}

// For addresses that send the visitor elsewhere: wait until the app has answered, without needing the shell.
async function arrive(page: Page, path: string): Promise<void> {
  await page.goto(path)
  await page.waitForLoadState('networkidle')
}

async function resize(page: Page, width: number): Promise<void> {
  await page.setViewportSize({ width, height: 800 })
  await settle(page)
}

function plusDays(day: string, days: number): string {
  const date = new Date(`${day}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

// The D30 answer the server gives when the end date moves before the end of an assignment (T#9 message format).
function excludedMessage(alpha: Detail, newEnd: string): string {
  const outside = alpha.assignments
    .filter((assignment) => assignment.startDate < alpha.startDate || assignment.endDate > newEnd)
    .sort((a, b) => a.startDate.localeCompare(b.startDate) || a.employeeName.localeCompare(b.employeeName))
  const listed = outside
    .slice(0, 3)
    .map((assignment) => `${assignment.employeeName} ${assignment.startDate} ~ ${assignment.endDate}`)
    .join(', ')
  return `프로젝트 기간을 바꾸면 기간 밖으로 나가는 배정 ${outside.length}건이 있어 저장할 수 없습니다: ${listed}`
}

// The message's box against its input(s): the gap under the lowest input, and the left edge against the first one.
async function messageUnder(inputs: Locator[], message: Locator) {
  const boxes = await Promise.all(inputs.map((input) => input.boundingBox()))
  const shown = (await message.boundingBox())!
  const bottom = Math.max(...boxes.map((box) => box!.y + box!.height))
  return { gap: shown.y - bottom, left: shown.x - boxes[0]!.x, right: shown.x + shown.width }
}

let before: Awaited<ReturnType<typeof sharedState>>

test.beforeAll(async ({ playwright }, testInfo) => {
  const request = await playwright.request.newContext({ baseURL: testInfo.project.use.baseURL })
  before = await sharedState(request)
  await request.dispose()
})

test.afterAll(async ({ playwright }, testInfo) => {
  const request = await playwright.request.newContext({ baseURL: testInfo.project.use.baseURL })
  expect(await sharedState(request), 'the shared e2e DB after this spec').toEqual(before)
  await request.dispose()
})

test.beforeEach(async ({ page }) => {
  await catchWrites(page)
})

test.describe('form addresses by role and width (criterion 4)', () => {
  for (const account of [PROJECT_MANAGER, DUAL_MANAGER] as DemoAccount[]) {
    test(`${account.username} reaches both forms from 프로젝트 등록 and 수정 at 1280px and 1024px`, async ({ page, request }) => {
      const id = await alphaId(request)
      await loginAs(page, account)
      for (const width of [1280, 1024]) {
        await open(page, width, '/projects/new')
        expect(await title(page, '프로젝트 등록').count(), `${width}px /projects/new heading`).toBe(1)

        await open(page, width, '/projects')
        await link(page, '프로젝트 등록').click()
        await expect.poll(() => pathOf(page), `${width}px 프로젝트 등록`).toBe('/projects/new')
        await expect(title(page, '프로젝트 등록')).toBeVisible()

        await open(page, width, `/projects/${id}`)
        await link(page, '수정').click()
        await expect.poll(() => pathOf(page), `${width}px 수정`).toBe(`/projects/${id}/edit`)
        await expect(title(page, '프로젝트 수정')).toBeVisible()
        await expect(nameInput(page)).toHaveValue(ALPHA)
      }
    })
  }

  test('project.manager does not see 프로젝트 등록 and 수정 at 1023px (regression, T#16)', async ({ page, request }) => {
    const id = await alphaId(request)
    await loginAs(page, PROJECT_MANAGER)
    await open(page, 1023, '/projects')
    await expect(link(page, ALPHA)).toBeVisible()
    await expect(link(page, '프로젝트 등록')).toBeHidden()
    await open(page, 1023, `/projects/${id}`)
    await expect(link(page, '인력 배치')).toBeVisible()
    await expect(link(page, '수정')).toBeHidden()
  })

  test('hr.manager is sent from the form addresses to the list and to the detail', async ({ page, request }) => {
    const id = await alphaId(request)
    await loginAs(page, HR_MANAGER)

    await open(page, 1280, '/projects/new')
    expect(pathOf(page), '/projects/new').toBe('/projects')
    await open(page, 1280, `/projects/${id}/edit`)
    expect(pathOf(page), `/projects/${id}/edit`).toBe(`/projects/${id}`)
  })

  test('employee.demo goes to 내 정보 and a logged-out visitor to the login form from the form addresses (regression)', async ({
    page,
    request,
  }) => {
    const id = await alphaId(request)
    const addresses = ['/projects/new', `/projects/${id}/edit`]
    for (const address of addresses) {
      await arrive(page, address)
      await expect.poll(() => pathOf(page), `logged out ${address}`).toBe('/login')
    }
    await loginAs(page, EMPLOYEE_ONLY)
    for (const address of addresses) {
      await arrive(page, address)
      await expect.poll(() => pathOf(page), `employee.demo ${address}`).toBe('/me')
    }
  })

  test('an edit address that is not a project goes to / (regression)', async ({ page }) => {
    await loginAs(page, PROJECT_MANAGER)
    await open(page, 1280, '/projects/abc/edit')
    expect(pathOf(page)).toBe('/')
  })
})

test.describe('the desktop notice below 1024px (criterion 5)', () => {
  test('1023px and 360px show the notice instead of the form, and nothing can be saved there', async ({ page, request }) => {
    const id = await alphaId(request)
    const caught = await catchWrites(page)
    await loginAs(page, PROJECT_MANAGER)
    const forms = [
      { path: '/projects/new', link: '프로젝트 목록으로', target: '/projects' },
      { path: `/projects/${id}/edit`, link: '프로젝트 상세로', target: `/projects/${id}` },
    ]
    for (const form of forms) {
      for (const width of [1023, 360]) {
        await open(page, width, form.path)
        expect(await page.getByText(NOTICE, { exact: true }).count(), `${width}px ${form.path} notice`).toBe(1)
        await expect(page.getByText(NOTICE, { exact: true })).toBeVisible()
        await expect(nameInput(page)).toBeHidden()
        await expect(button(page, '저장')).toBeHidden()
        // Tab through the page: no control of the hidden form takes the focus.
        await page.locator('body').focus()
        for (let i = 0; i < 12; i += 1) {
          await page.keyboard.press('Tab')
          const inForm = await page.evaluate(() => Boolean(document.activeElement?.closest('form')))
          expect(inForm, `${width}px Tab ${i + 1} stays out of the form`).toBe(false)
        }
      }
      await link(page, form.link).click()
      await expect.poll(() => pathOf(page)).toBe(form.target)
    }
    expect(caught, 'writes the page tried').toEqual([])
  })

  test('1024px and 1280px show the form and not the notice', async ({ page, request }) => {
    const id = await alphaId(request)
    await loginAs(page, PROJECT_MANAGER)
    for (const path of ['/projects/new', `/projects/${id}/edit`]) {
      for (const width of [1024, 1280]) {
        await open(page, width, path)
        expect(await nameInput(page).count(), `${width}px ${path} form`).toBe(1)
        await expect(nameInput(page), `${width}px ${path} form`).toBeVisible()
        await expect(page.getByText(NOTICE, { exact: true })).toBeHidden()
      }
    }
  })

  test('the typed value stays when the window narrows and widens again', async ({ page }) => {
    await loginAs(page, PROJECT_MANAGER)
    await open(page, 1280, '/projects/new')
    expect(await nameInput(page).count(), 'the form').toBe(1)
    await expect(nameInput(page)).toBeVisible()
    await nameInput(page).fill('임시')
    await resize(page, 360)
    await expect(page.getByText(NOTICE, { exact: true })).toBeVisible()
    await resize(page, 1280)
    await expect(nameInput(page)).toHaveValue('임시')
  })
})

test.describe('look and widths (criterion 6)', () => {
  test('the form is 720px wide, labels on one left edge, the dates side by side, a row on one line, a 40px 저장', async ({
    page,
    request,
  }) => {
    const id = await alphaId(request)
    await loginAs(page, PROJECT_MANAGER)
    await open(page, 1280, `/projects/${id}/edit`)
    expect(await nameInput(page).count(), 'the form').toBe(1)
    await expect(nameInput(page)).toHaveValue(ALPHA)
    for (const width of [1280, 1024]) {
      await resize(page, width)
      const measured = await page.evaluate(() => {
        const form = document.querySelector('main form')!
        const rect = form.getBoundingClientRect()
        const labels = Array.from(form.querySelectorAll(':scope > .field > label, :scope > fieldset > legend'))
        const row = form.querySelector('[role="group"][aria-label="필요 역량 1"]')!
        const rowControls = Array.from(row.querySelectorAll('input, select, button')).map((control) =>
          control.getBoundingClientRect(),
        )
        const dates = Array.from(form.querySelectorAll('input[type="date"]')).map((input) => input.getBoundingClientRect())
        return {
          width: rect.width,
          right: rect.right,
          lefts: labels.map((label) => label.getBoundingClientRect().left),
          names: labels.map((label) => (label.textContent ?? '').replace('*', '').trim()),
          save: Array.from(form.querySelectorAll('button')).find((b) => b.textContent?.trim() === '저장')!.getBoundingClientRect()
            .height,
          dateTops: dates.map((date) => date.top),
          dateLefts: dates.map((date) => date.left),
          rowCount: rowControls.length,
          rowBottoms: rowControls.map((control) => control.bottom),
          rowRight: Math.max(...rowControls.map((control) => control.right)),
        }
      })
      expect(measured.names, `${width}px labels`).toEqual(['프로젝트명', '설명', '기간', '상태', '필요 역량'])
      expect(Math.abs(measured.width - 720), `${width}px form width`).toBeLessThanOrEqual(1)
      for (const left of measured.lefts) {
        expect(Math.abs(left - measured.lefts[0]), `${width}px label left`).toBeLessThanOrEqual(1)
      }
      expect(measured.save, `${width}px 저장 height`).toBe(40)
      expect(measured.dateTops, `${width}px two dates`).toHaveLength(2)
      expect(Math.abs(measured.dateTops[0] - measured.dateTops[1]), `${width}px dates on one line`).toBeLessThanOrEqual(1)
      expect(measured.dateLefts[1], `${width}px 종료일 right of 시작일`).toBeGreaterThan(measured.dateLefts[0])
      expect(measured.rowCount, `${width}px 직무, 기술, 숙련도, 인원, 삭제`).toBe(5)
      for (const bottom of measured.rowBottoms) {
        expect(Math.abs(bottom - measured.rowBottoms[0]), `${width}px row on one line`).toBeLessThanOrEqual(1)
      }
      expect(measured.rowRight, `${width}px row inside the form`).toBeLessThanOrEqual(measured.right + 0.5)
    }
  })

  test('D30: the three-assignment server message sits under the two dates, which take the danger border', async ({
    page,
    request,
  }) => {
    const alpha = await alphaDetail(request)
    // The day before the earliest assignment end: every assignment of 알파 falls outside, so the message lists three
    // (the contract's long message, T#9 lists at most three).
    expect(alpha.assignments, 'the seeded assignments of 알파').toHaveLength(3)
    const earliestEnd = alpha.assignments.map((assignment) => assignment.endDate).sort()[0]
    const newEnd = plusDays(earliestEnd, -1)
    const message = excludedMessage(alpha, newEnd)
    expect(message, 'the D30 message').toContain('배정 3건이')
    for (const assignment of alpha.assignments) {
      expect(message, 'the D30 message').toContain(`${assignment.employeeName} ${assignment.startDate} ~ ${assignment.endDate}`)
    }
    await loginAs(page, PROJECT_MANAGER)
    await page.route(
      (url) => url.pathname === `/api/projects/${alpha.id}`,
      (route) =>
        route.request().method() === 'PUT'
          ? json(route, { code: 'PROJECT_PERIOD_EXCLUDES_ASSIGNMENTS', message }, 400)
          : route.fallback(),
    )
    await open(page, 1280, `/projects/${alpha.id}/edit`)
    expect(await nameInput(page).count(), 'the form').toBe(1)
    await endInput(page).fill(newEnd)
    await button(page, '저장').click()
    const shown = page.getByText(message, { exact: true })
    await expect(shown).toBeVisible()

    for (const width of [1280, 1024]) {
      await resize(page, width)
      for (const date of [startInput(page), endInput(page)]) {
        expect(await date.evaluate((input) => getComputedStyle(input).borderTopColor), `${width}px date border`).toBe(DANGER)
      }
      const measured = await messageUnder([startInput(page), endInput(page)], shown)
      expect(measured.gap, `${width}px gap`).toBeGreaterThanOrEqual(0)
      expect(measured.gap, `${width}px gap`).toBeLessThanOrEqual(4)
      expect(Math.abs(measured.left), `${width}px left edge`).toBeLessThanOrEqual(1)
      const formRight = await page.locator('main form').evaluate((form) => form.getBoundingClientRect().right)
      expect(measured.right, `${width}px inside the form`).toBeLessThanOrEqual(formRight + 0.5)
      // The long message wraps inside the form: more than one 20px line (BRIEF §3.2 sm text).
      expect((await shown.boundingBox())!.height, `${width}px the message wraps`).toBeGreaterThanOrEqual(40)
    }
    await expectNoHorizontalOverflow(page, [1280, 1024])
  })

  test('a status error has the danger border and its message right under the select', async ({ page }) => {
    await loginAs(page, PROJECT_MANAGER)
    await page.route(
      (url) => url.pathname === '/api/projects',
      (route) =>
        route.request().method() === 'POST'
          ? json(route, { code: 'PROJECT_STATUS_INVALID', message: '프로젝트 상태를 선택하세요.' }, 400)
          : route.fallback(),
    )
    await open(page, 1280, '/projects/new')
    expect(await nameInput(page).count(), 'the form').toBe(1)
    await nameInput(page).fill('검사')
    await button(page, '저장').click()
    const shown = page.getByText('프로젝트 상태를 선택하세요.', { exact: true })
    await expect(shown).toBeVisible()
    await settle(page)

    expect(await statusSelect(page).evaluate((select) => getComputedStyle(select).borderTopColor)).toBe(DANGER)
    const measured = await messageUnder([statusSelect(page)], shown)
    expect(measured.gap).toBeGreaterThanOrEqual(0)
    expect(measured.gap).toBeLessThanOrEqual(4)
    expect(Math.abs(measured.left)).toBeLessThanOrEqual(1)
  })

  test('48-character values stay inside the edit form', async ({ page, request }) => {
    const alpha = await alphaDetail(request)
    await loginAs(page, PROJECT_MANAGER)
    await page.route(
      (url) => url.pathname === `/api/projects/${FIXED_ID}`,
      (route) =>
        route.request().method() === 'GET'
          ? json(route, {
              ...alpha,
              id: FIXED_ID,
              name: LONG_NAME,
              description: LONG_NAME,
              requiredSkills: [{ jobTitle: LONG_NAME, skillName: LONG_NAME, proficiencyLevel: 'ADVANCED', headcount: 2 }],
            })
          : route.fallback(),
    )
    await open(page, 1280, `/projects/${FIXED_ID}/edit`)
    expect(await title(page, '프로젝트 수정').count(), 'the edit form').toBe(1)
    await expect(nameInput(page)).toHaveValue(LONG_NAME)
    for (const width of [1280, 1024]) {
      await resize(page, width)
      const outside = await page.evaluate(() => {
        const form = document.querySelector('main form')!.getBoundingClientRect()
        return Array.from(document.querySelectorAll('main form input, main form select, main form button'))
          .map((control) => control.getBoundingClientRect())
          .filter((rect) => rect.left < form.left - 0.5 || rect.right > form.right + 0.5).length
      })
      expect(outside, `${width}px controls past the form`).toBe(0)
    }
    await expectNoHorizontalOverflow(page, [1280, 1024])
  })

  test('no horizontal overflow on the screens of this task at their widths', async ({ page, request }) => {
    const id = await alphaId(request)
    await loginAs(page, PROJECT_MANAGER)

    await open(page, 1280, '/projects/new')
    expect(await nameInput(page).count(), 'the form').toBe(1)
    await expect(nameInput(page)).toBeVisible()
    await expectNoHorizontalOverflow(page, [1280, 1024])

    for (const path of ['/projects/new', `/projects/${id}/edit`]) {
      await open(page, 1023, path)
      await expect(page.getByText(NOTICE, { exact: true })).toBeVisible()
      await expectNoHorizontalOverflow(page, [1023, 360])
    }
  })
})
