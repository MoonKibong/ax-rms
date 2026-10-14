import { expect, test, type APIRequestContext, type Page } from '@playwright/test'
import { DUAL_MANAGER, EMPLOYEE_ONLY, HR_MANAGER, PROJECT_MANAGER, loginAs, type DemoAccount } from './support/auth'
import { expectNoHorizontalOverflow, settle } from './support/layout'
import { json } from './support/projects'

// T#39 criteria 8–10 on the shared e2e DB (backend/data/e2e.db): the management buttons by role and width, the form
// addresses, the desktop notice below 1024px, and the look of the form and the dialog. No employee write leaves the
// browser: every POST/PUT/PATCH /api/employees… is answered by page.route (catchWrites), and the spec compares the
// shared DB at its start and its end.

type Detail = {
  id: number
  name: string
  jobTitle: string
  availabilityStatus: string
  skills: Array<{ skillName: string; proficiencyLevel: string }>
  assignments: unknown[]
  today: string
  [key: string]: unknown
}

const LONG = 'abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJKL'
const FIXED_ID = 9001
const DANGER = 'rgb(191, 43, 27)'
const NOTICE = '데스크톱에서 이용해 주세요'

const pathOf = (page: Page) => new URL(page.url()).pathname
const nameInput = (page: Page) => page.getByRole('textbox', { name: '이름', exact: true })
const departmentSelect = (page: Page) => page.getByRole('combobox', { name: '부서', exact: true })
const jobInput = (page: Page) => page.getByRole('textbox', { name: '직무', exact: true })
const careerInput = (page: Page) => page.getByRole('spinbutton', { name: '경력(년)', exact: true })
const button = (page: Page, name: string) => page.getByRole('button', { name, exact: true })

async function idsByName(request: APIRequestContext): Promise<Record<string, number>> {
  const login = await request.post('/api/auth/login', {
    data: { username: HR_MANAGER.username, password: HR_MANAGER.password },
  })
  expect(login.status(), 'hr.manager login').toBe(200)
  const response = await request.get('/api/employees')
  expect(response.status(), 'GET /api/employees').toBe(200)
  const list = (await response.json()) as Array<{ id: number; name: string }>
  return Object.fromEntries(list.map((employee) => [employee.name, employee.id]))
}

// What the shared DB holds for this spec's comparison: the number of employees and two details without `today`.
async function sharedState(request: APIRequestContext) {
  const ids = await idsByName(request)
  const list = (await (await request.get('/api/employees')).json()) as unknown[]
  const detail = async (name: string) => {
    const { today, ...rest } = (await (await request.get(`/api/employees/${ids[name]}`)).json()) as Detail
    void today
    return rest
  }
  return { count: list.length, park: await detail('박소영'), choi: await detail('최동훈') }
}

// Answers every employee write in the browser, so nothing reaches the shared DB. Registered first in each test, so a
// test's own page.route (registered later) answers before it; GETs fall through to the server.
async function catchWrites(page: Page): Promise<string[]> {
  const caught: string[] = []
  await page.route(
    (url) => url.pathname.startsWith('/api/employees'),
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

async function resize(page: Page, width: number): Promise<void> {
  await page.setViewportSize({ width, height: 800 })
  await settle(page)
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

test.describe('buttons and addresses by role and width (criterion 8)', () => {
  for (const account of [HR_MANAGER, DUAL_MANAGER] as DemoAccount[]) {
    test(`${account.username} sees 수정, 상태 변경 and 직원 등록 from 1024px up, and not below`, async ({ page, request }) => {
      const ids = await idsByName(request)
      await loginAs(page, account)
      await open(page, 1280, `/employees/${ids['박소영']}`)

      expect(await button(page, '수정').count(), '수정 on the detail').toBe(1)
      expect(
        await page.locator('main button').evaluateAll((buttons) => buttons.map((b) => (b.textContent ?? '').trim())),
        'buttons of the detail',
      ).toEqual(['수정', '상태 변경'])
      for (const width of [1280, 1024]) {
        await resize(page, width)
        await expect(button(page, '수정'), `${width}px 수정`).toBeVisible()
        await expect(button(page, '상태 변경'), `${width}px 상태 변경`).toBeVisible()
      }
      for (const width of [1023, 360]) {
        await resize(page, width)
        await expect(button(page, '수정'), `${width}px 수정`).toBeHidden()
        await expect(button(page, '상태 변경'), `${width}px 상태 변경`).toBeHidden()
      }

      await open(page, 1280, '/employees')
      for (const width of [1280, 1024]) {
        await resize(page, width)
        await expect(button(page, '직원 등록'), `${width}px 직원 등록`).toBeVisible()
      }
      for (const width of [1023, 360]) {
        await resize(page, width)
        await expect(button(page, '직원 등록'), `${width}px 직원 등록`).toBeHidden()
      }
    })

    test(`${account.username}: 직원 등록 opens /employees/new and 수정 opens the edit form`, async ({ page, request }) => {
      const ids = await idsByName(request)
      await loginAs(page, account)
      await open(page, 1280, '/employees')

      expect(await button(page, '직원 등록').count(), '직원 등록 on the list').toBe(1)
      await button(page, '직원 등록').click()
      await expect.poll(() => pathOf(page)).toBe('/employees/new')
      await expect(page.getByRole('heading', { level: 1, name: '직원 등록' })).toBeVisible()

      await open(page, 1280, `/employees/${ids['박소영']}`)
      await button(page, '수정').click()
      await expect.poll(() => pathOf(page)).toBe(`/employees/${ids['박소영']}/edit`)
      await expect(nameInput(page)).toHaveValue('박소영')
    })
  }

  test('project.manager has none of the three buttons at any width (regression)', async ({ page, request }) => {
    const ids = await idsByName(request)
    await loginAs(page, PROJECT_MANAGER)
    await open(page, 1280, `/employees/${ids['박소영']}`)
    expect(await page.getByRole('heading', { level: 1, name: '박소영' }).count(), 'employee heading').toBe(1)
    for (const width of [1280, 1024, 1023, 360]) {
      await resize(page, width)
      expect(await page.locator('main button').count(), `${width}px buttons of the detail`).toBe(0)
    }
    await open(page, 1280, '/employees')
    await expect(page.locator('tbody a').first()).toBeVisible()
    for (const width of [1280, 1024, 1023, 360]) {
      await resize(page, width)
      expect(await button(page, '직원 등록').count(), `${width}px 직원 등록`).toBe(0)
    }
  })

  test('project.manager is sent from the form addresses to the list and to the detail', async ({ page, request }) => {
    const ids = await idsByName(request)
    await loginAs(page, PROJECT_MANAGER)

    await page.goto('/employees/new')
    await expect.poll(() => pathOf(page), '/employees/new').toBe('/employees')
    await page.goto(`/employees/${ids['박소영']}/edit`)
    await expect.poll(() => pathOf(page), '/employees/<박소영>/edit').toBe(`/employees/${ids['박소영']}`)
  })

  test('employee.demo goes to 내 정보 and a logged-out visitor to the login form from the form addresses (regression)', async ({
    page,
    request,
  }) => {
    const ids = await idsByName(request)
    const addresses = ['/employees/new', `/employees/${ids['박소영']}/edit`]
    for (const address of addresses) {
      await page.goto(address)
      await expect.poll(() => pathOf(page), `logged out ${address}`).toBe('/login')
    }
    await loginAs(page, EMPLOYEE_ONLY)
    for (const address of addresses) {
      await page.goto(address)
      await expect.poll(() => pathOf(page), `employee.demo ${address}`).toBe('/me')
    }
  })
})

test.describe('the desktop notice below 1024px (criterion 9)', () => {
  test('1023px and 360px show the notice instead of the form, and nothing can be saved there', async ({ page, request }) => {
    const ids = await idsByName(request)
    const caught = await catchWrites(page)
    await loginAs(page, HR_MANAGER)
    const forms = [
      { path: '/employees/new', link: '직원 목록으로', target: '/employees' },
      { path: `/employees/${ids['박소영']}/edit`, link: '직원 상세로', target: `/employees/${ids['박소영']}` },
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
      await page.getByRole('link', { name: form.link }).click()
      await expect.poll(() => pathOf(page)).toBe(form.target)
    }
    expect(caught, 'writes the page tried').toEqual([])
  })

  test('1024px and 1280px show the form and not the notice', async ({ page, request }) => {
    const ids = await idsByName(request)
    await loginAs(page, HR_MANAGER)
    for (const path of ['/employees/new', `/employees/${ids['박소영']}/edit`]) {
      for (const width of [1024, 1280]) {
        await open(page, width, path)
        expect(await nameInput(page).count(), `${width}px ${path} form`).toBe(1)
        await expect(nameInput(page), `${width}px ${path} form`).toBeVisible()
        await expect(page.getByText(NOTICE, { exact: true })).toBeHidden()
      }
    }
  })

  test('the typed value stays when the window narrows and widens again', async ({ page }) => {
    await loginAs(page, HR_MANAGER)
    await open(page, 1280, '/employees/new')
    expect(await nameInput(page).count(), 'the form').toBe(1)
    await expect(nameInput(page)).toBeVisible()
    await nameInput(page).fill('임시')
    await resize(page, 360)
    await expect(page.getByText(NOTICE, { exact: true })).toBeVisible()
    await resize(page, 1280)
    await expect(nameInput(page)).toHaveValue('임시')
  })
})

test.describe('look and widths (criterion 10)', () => {
  test('the dialog: 480px in the middle, focus inside, Escape returns to 상태 변경, the backdrop covers the viewport', async ({
    page,
    request,
  }) => {
    const ids = await idsByName(request)
    await loginAs(page, HR_MANAGER)
    await open(page, 1280, `/employees/${ids['박소영']}`)
    expect(await button(page, '상태 변경').count(), '상태 변경').toBe(1)

    await button(page, '상태 변경').click()
    const dialog = page.getByRole('dialog', { name: '상태 변경' })
    await expect(dialog).toBeVisible()
    await settle(page)
    const box = await page.evaluate(() => {
      const element = document.querySelector('[role="dialog"]')!.getBoundingClientRect()
      const backdrop = document.querySelector('[role="dialog"]')!.parentElement!.getBoundingClientRect()
      return {
        width: element.width,
        left: element.left,
        right: document.documentElement.clientWidth - element.right,
        backdrop: { left: backdrop.left, top: backdrop.top, width: backdrop.width, height: backdrop.height },
        viewport: { width: document.documentElement.clientWidth, height: window.innerHeight },
      }
    })
    expect(Math.abs(box.width - 480), 'dialog width').toBeLessThanOrEqual(1)
    expect(Math.abs(box.left - box.right), 'left and right margins').toBeLessThanOrEqual(1)
    expect(box.backdrop).toEqual({ left: 0, top: 0, width: box.viewport.width, height: box.viewport.height })

    const inDialog = () => page.evaluate(() => Boolean(document.activeElement?.closest('[role="dialog"]')))
    await expect(page.getByRole('combobox', { name: '상태', exact: true })).toBeFocused()
    for (let i = 0; i < 8; i += 1) {
      await page.keyboard.press('Tab')
      expect(await inDialog(), `Tab ${i + 1}`).toBe(true)
    }
    for (let i = 0; i < 8; i += 1) {
      await page.keyboard.press('Shift+Tab')
      expect(await inDialog(), `Shift+Tab ${i + 1}`).toBe(true)
    }
    await page.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)
    await expect(button(page, '상태 변경')).toBeFocused()
  })

  test('the form is 560px wide with the labels on one left edge and a 40px 저장, at 1280px and 1024px', async ({ page }) => {
    await loginAs(page, HR_MANAGER)
    await open(page, 1280, '/employees/new')
    expect(await nameInput(page).count(), 'the form').toBe(1)
    for (const width of [1280, 1024]) {
      await resize(page, width)
      const measured = await page.evaluate(() => {
        const form = document.querySelector('main form')!
        const labels = Array.from(form.querySelectorAll(':scope > .field > label, :scope > fieldset > legend'))
        return {
          width: form.getBoundingClientRect().width,
          lefts: labels.map((label) => label.getBoundingClientRect().left),
          names: labels.map((label) => (label.textContent ?? '').replace('*', '').trim()),
          save: Array.from(form.querySelectorAll('button')).find((b) => b.textContent?.trim() === '저장')!.getBoundingClientRect().height,
        }
      })
      expect(measured.names, `${width}px labels`).toEqual(['이름', '부서', '직무', '기술', '경력(년)'])
      expect(Math.abs(measured.width - 560), `${width}px form width`).toBeLessThanOrEqual(1)
      for (const left of measured.lefts) {
        expect(Math.abs(left - measured.lefts[0]), `${width}px label left`).toBeLessThanOrEqual(1)
      }
      expect(measured.save, `${width}px 저장 height`).toBe(40)
    }
  })

  test('a select box error has the danger border and its message right under it', async ({ page }) => {
    await loginAs(page, HR_MANAGER)
    await page.route(
      (url) => url.pathname === '/api/employees',
      (route) =>
        route.request().method() === 'POST'
          ? json(route, { code: 'EMPLOYEE_DEPARTMENT_NOT_FOUND', message: '부서를 찾을 수 없습니다.' }, 400)
          : route.fallback(),
    )
    await open(page, 1280, '/employees/new')
    expect(await nameInput(page).count(), 'the form').toBe(1)
    await nameInput(page).fill('검사')
    await jobInput(page).fill('QA')
    await careerInput(page).fill('3')
    await button(page, '저장').click()
    await expect(page.getByText('부서를 찾을 수 없습니다.', { exact: true })).toBeVisible()
    await settle(page)

    const measured = await departmentSelect(page).evaluate((select) => {
      const message = document.getElementById(select.getAttribute('aria-describedby') ?? '')!
      const s = select.getBoundingClientRect()
      const m = message.getBoundingClientRect()
      return { border: getComputedStyle(select).borderTopColor, gap: m.top - s.bottom, left: m.left - s.left }
    })
    expect(measured.border).toBe(DANGER)
    expect(measured.gap).toBeGreaterThanOrEqual(0)
    expect(measured.gap).toBeLessThanOrEqual(4)
    expect(Math.abs(measured.left)).toBeLessThanOrEqual(1)
  })

  test('48-character values stay inside the edit form', async ({ page }) => {
    await loginAs(page, HR_MANAGER)
    const ids = await idsByName(page.request)
    const park = (await (await page.request.get(`/api/employees/${ids['박소영']}`)).json()) as Detail
    await page.route(
      (url) => url.pathname === `/api/employees/${FIXED_ID}`,
      (route) =>
        route.request().method() === 'GET'
          ? json(route, {
              ...park,
              id: FIXED_ID,
              name: LONG,
              jobTitle: LONG,
              skills: [{ skillName: LONG, proficiencyLevel: 'ADVANCED' }],
            })
          : route.fallback(),
    )
    await open(page, 1280, `/employees/${FIXED_ID}/edit`)
    expect(await page.getByRole('heading', { level: 1, name: '직원 수정' }).count(), 'the edit form').toBe(1)
    await expect(nameInput(page)).toHaveValue(LONG)
    for (const width of [1280, 1024]) {
      await resize(page, width)
      const outside = await page.evaluate(() => {
        const form = document.querySelector('main form')!.getBoundingClientRect()
        return Array.from(document.querySelectorAll('main form input, main form select'))
          .map((control) => control.getBoundingClientRect())
          .filter((rect) => rect.left < form.left - 0.5 || rect.right > form.right + 0.5).length
      })
      expect(outside, `${width}px controls past the form`).toBe(0)
    }
    await expectNoHorizontalOverflow(page, [1280, 1024])
  })

  test('no horizontal overflow on the screens of this task at their widths', async ({ page, request }) => {
    const ids = await idsByName(request)
    await loginAs(page, HR_MANAGER)

    await open(page, 1280, '/employees/new')
    expect(await nameInput(page).count(), 'the form').toBe(1)
    await expect(nameInput(page)).toBeVisible()
    await expectNoHorizontalOverflow(page, [1280, 1024])

    await open(page, 1280, '/employees')
    await expect(button(page, '직원 등록')).toBeVisible()
    await expectNoHorizontalOverflow(page, [1280, 1024])
    await open(page, 1023, '/employees')
    await expect(button(page, '직원 등록')).toBeHidden()
    await expectNoHorizontalOverflow(page, [1023, 360])

    await open(page, 1280, `/employees/${ids['박소영']}`)
    await expect(button(page, '수정')).toBeVisible()
    await expectNoHorizontalOverflow(page, [1280, 1024])
    await button(page, '상태 변경').click()
    await expect(page.getByRole('dialog', { name: '상태 변경' })).toBeVisible()
    await expectNoHorizontalOverflow(page, [1280, 1024])

    await open(page, 1023, `/employees/${ids['박소영']}`)
    await expect(button(page, '수정')).toBeHidden()
    await expectNoHorizontalOverflow(page, [1023, 360])

    await open(page, 1023, '/employees/new')
    await expect(page.getByText(NOTICE, { exact: true })).toBeVisible()
    await expectNoHorizontalOverflow(page, [1023, 360])
  })
})
