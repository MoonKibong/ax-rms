import { expect, test, type Page, type Route } from '@playwright/test'
import { EMPLOYEE_ONLY, PROJECT_MANAGER, loginAs } from './support/auth'
import {
  EMPTY,
  EMPTY_TITLES,
  LIST_TITLES,
  LONG_EMPLOYEE,
  LONG_PROJECT,
  WITH_ITEMS,
  expectDashboard,
  json,
  openAt,
  region,
  stubDashboard,
  type Dashboard,
} from './support/dashboard'
import { expectNoHorizontalOverflow, settle } from './support/layout'

// T#18: the dashboard screen. Criterion 6 uses the real seed and compares the screen with GET /api/dashboard of the
// same session (the seed's dates follow the day the e2e DB was made); 7 replaces GET /api/dashboard; 8 is the role
// check; 9 the widths.
const WIDTHS = [1280, 1024, 1023, 360]
const WARNING = { color: 'rgb(143, 83, 0)', background: 'rgb(253, 241, 220)' }
const TEXT_MUTED = 'rgb(85, 96, 110)'

const count = (value: number) => value.toLocaleString('ko-KR')
const tiles = (page: Page) => region(page, '요약').getByRole('link')

function tileTexts(dashboard: Dashboard): string[] {
  return [
    `전체 직원${count(dashboard.employeeCount)}명`,
    `투입 가능${count(dashboard.availableCount)}명`,
    `투입 불가${count(dashboard.unavailableCount)}명`,
    `가용 인원${count(dashboard.availableHeadcount)}명`,
    `진행 프로젝트${count(dashboard.ongoingProjectCount)}개`,
  ]
}

const TILE_HREFS = [
  '/employees',
  '/employees?status=AVAILABLE',
  '/employees?status=UNAVAILABLE',
  '/employees?status=AVAILABLE',
  '/projects?status=IN_PROGRESS',
]

// What one list shows: the link names and addresses, and the values on the right.
async function listOf(page: Page, title: string) {
  const list = region(page, title)
  return {
    names: await list.getByRole('listitem').getByRole('link').allTextContents(),
    hrefs: await list
      .getByRole('listitem')
      .getByRole('link')
      .evaluateAll((links) => links.map((link) => link.getAttribute('href'))),
    values: await list.locator('.dashboard-list__value').allTextContents(),
    text: await list.innerText(),
  }
}

async function waitForAnswer(page: Page): Promise<void> {
  await expect(tiles(page)).toHaveCount(5)
  await expect(page.getByText('불러오는 중…')).toHaveCount(0)
  await settle(page)
}

const pathOf = (page: Page) => {
  const url = new URL(page.url())
  return url.pathname + url.search
}

for (const width of [1280, 360]) {
  test(`dashboard with the seed shows GET /api/dashboard as it is at ${width}px`, async ({ page }) => {
    await loginAs(page, PROJECT_MANAGER)
    await openAt(page, width)
    await expectDashboard(page)
    await waitForAnswer(page)

    const api = (await (await page.request.get('/api/dashboard')).json()) as Dashboard

    expect(await tiles(page).allTextContents()).toEqual(tileTexts(api))
    expect(await tiles(page).evaluateAll((links) => links.map((link) => link.getAttribute('href')))).toEqual(TILE_HREFS)
    expect(await page.getByRole('heading', { level: 2 }).allTextContents()).toEqual(LIST_TITLES)

    const review = await listOf(page, '확인 필요 배치')
    if (api.needsReview.length === 0) {
      expect(review.text).toContain('확인이 필요한 배치가 없습니다')
    } else {
      expect(review.names).toEqual(api.needsReview.map((employee) => employee.name))
      expect(review.hrefs).toEqual(api.needsReview.map((employee) => `/employees/${employee.id}`))
    }

    const short = await listOf(page, '인력 부족 프로젝트')
    if (api.shortStaffedProjects.length === 0) {
      expect(short.text).toContain('인력이 부족한 프로젝트가 없습니다')
    } else {
      expect(short.names).toEqual(api.shortStaffedProjects.map((project) => project.name))
      expect(short.hrefs).toEqual(api.shortStaffedProjects.map((project) => `/projects/${project.id}`))
    }

    const employees = await listOf(page, '직원별 가용률')
    expect(employees.names).toEqual(api.employees.map((employee) => employee.name))
    expect(employees.values).toEqual(api.employees.map((employee) => `${employee.currentAvailability}%`))
    expect(employees.hrefs).toEqual(api.employees.map((employee) => `/employees/${employee.id}`))

    const departments = await listOf(page, '부서별 평균 가용률')
    expect(departments.names).toEqual(api.departments.map((department) => department.name))
    expect(departments.values).toEqual(api.departments.map((department) => `${department.averageAvailability.toFixed(1)}%`))
    expect(departments.hrefs).toEqual(api.departments.map((department) => `/employees?departmentId=${department.id}`))
  })

  test(`moving from the dashboard to details and lists at ${width}px`, async ({ page }) => {
    await loginAs(page, PROJECT_MANAGER)
    await openAt(page, width)
    await expectDashboard(page)
    await waitForAnswer(page)

    // An employee of the list → that employee's detail.
    const employee = region(page, '직원별 가용률').getByRole('link').first()
    const employeeName = (await employee.textContent()) ?? ''
    const employeeHref = (await employee.getAttribute('href')) ?? ''
    await employee.click()
    await page.waitForURL((url) => url.pathname === employeeHref)
    await expect(page.getByRole('heading', { level: 1, name: employeeName })).toBeVisible()

    // A department → the employee list filtered by that department (T#13).
    await openAt(page, width)
    await waitForAnswer(page)
    const department = region(page, '부서별 평균 가용률').getByRole('link').first()
    const departmentHref = (await department.getAttribute('href')) ?? ''
    const departmentId = new URLSearchParams(departmentHref.split('?')[1]).get('departmentId')
    await department.click()
    await page.waitForURL((url) => url.pathname + url.search === departmentHref)
    await expect(page.getByLabel('부서', { exact: true })).toHaveValue(departmentId ?? '')

    // The 진행 프로젝트 tile → the project list filtered by 진행 중 (T#15).
    await openAt(page, width)
    await waitForAnswer(page)
    await tiles(page).filter({ hasText: '진행 프로젝트' }).click()
    await page.waitForURL((url) => url.pathname + url.search === '/projects?status=IN_PROGRESS')
    await expect(
      page.getByRole('group', { name: '상태 필터' }).getByRole('button', { name: '진행 중', exact: true }),
    ).toHaveAttribute('aria-pressed', 'true')

    // The 투입 불가 tile → the employee list filtered by 투입 불가.
    await openAt(page, width)
    await waitForAnswer(page)
    await tiles(page).filter({ hasText: '투입 불가' }).click()
    await page.waitForURL((url) => url.pathname + url.search === '/employees?status=UNAVAILABLE')
    expect(pathOf(page)).toBe('/employees?status=UNAVAILABLE')
  })

  test(`coming back through the menu asks for the dashboard again (D36) at ${width}px`, async ({ page }) => {
    const calls: string[] = []
    page.on('request', (request) => {
      if (new URL(request.url()).pathname === '/api/dashboard') calls.push(request.url())
    })
    await loginAs(page, PROJECT_MANAGER)
    await openAt(page, width)
    await expectDashboard(page)
    await waitForAnswer(page)
    expect(calls).toHaveLength(1)

    await page.getByRole('navigation').getByRole('link', { name: '직원', exact: true }).click()
    await page.waitForURL((url) => url.pathname === '/employees')
    await page.getByRole('navigation').getByRole('link', { name: '대시보드', exact: true }).click()
    await page.waitForURL((url) => url.pathname === '/')

    await expect.poll(() => calls.length).toBe(2)
    await waitForAnswer(page)
  })
}

for (const width of WIDTHS) {
  test(`fixed answer with every list filled at ${width}px`, async ({ page }) => {
    await loginAs(page, PROJECT_MANAGER)
    await stubDashboard(page, (route) => json(route, WITH_ITEMS))
    await openAt(page, width)
    await expectDashboard(page)
    await waitForAnswer(page)

    expect(await tiles(page).allTextContents()).toEqual(tileTexts(WITH_ITEMS))
    const short = await listOf(page, '인력 부족 프로젝트')
    expect(short.text).toContain('필요 2명 / 배치 1명')
    expect(short.text).toContain('부족한 역량: Java 2명')
    expect(short.text).toContain('필요 5명 / 배치 3명')
    expect(short.text).toContain('부족한 역량: React 1명, Kubernetes 2명')
    expect((await listOf(page, '부서별 평균 가용률')).values).toEqual(['70.6%', '93.6%', '72.0%'])
    expect((await listOf(page, '직원별 가용률')).values).toEqual(['40%', '60%', '100%', '0%'])

    const facts = await page.evaluate(
      ({ longNames }) => {
        const css = (element: Element) => getComputedStyle(element)
        const rect = (element: Element) => element.getBoundingClientRect()
        const sections = Array.from(document.querySelectorAll('main section')).filter((section) =>
          section.querySelector('h2'),
        )
        const tileElements = Array.from(document.querySelectorAll('.dashboard-tile'))
        const longLinks = Array.from(document.querySelectorAll('main a')).filter((link) =>
          longNames.includes(link.textContent ?? ''),
        )
        const valueRights = (index: number) =>
          Array.from(sections[index].querySelectorAll('.dashboard-list__value')).map((value) =>
            Math.round(rect(value).right),
          )
        return {
          tiles: tileElements.map((tile) => ({
            top: Math.round(rect(tile).top),
            left: Math.round(rect(tile).left),
            width: rect(tile).width,
          })),
          sections: sections.map((section) => ({
            title: section.querySelector('h2')?.textContent,
            top: Math.round(rect(section).top),
            left: Math.round(rect(section).left),
          })),
          long: longLinks.map((link) => ({
            fits: link.scrollWidth <= link.clientWidth,
            insideItem: rect(link).right <= rect(link.closest('li')!).right + 0.5,
            text: link.textContent,
          })),
          badges: Array.from(document.querySelectorAll('main [data-status]')).map((badge) => ({
            status: badge.getAttribute('data-status'),
            color: css(badge).color,
            background: css(badge).backgroundColor,
          })),
          value: (() => {
            const value = document.querySelector('.dashboard-tile__value')!
            return { size: css(value).fontSize, weight: css(value).fontWeight }
          })(),
          label: (() => {
            const label = document.querySelector('.dashboard-tile__label')!
            return { size: css(label).fontSize, color: css(label).color }
          })(),
          employeeRights: valueRights(2),
          departmentRights: valueRights(3),
          ellipsis: document.body.innerText.includes('…'),
        }
      },
      { longNames: [LONG_EMPLOYEE, LONG_PROJECT] },
    )

    // Long names wrap inside their item, with no ellipsis (BRIEF §5).
    expect(facts.long.map((link) => link.text).sort()).toEqual(
      [LONG_EMPLOYEE, LONG_EMPLOYEE, LONG_PROJECT].sort(),
    )
    for (const link of facts.long) {
      expect(link.fits, `${link.text} fits`).toBe(true)
      expect(link.insideItem, `${link.text} inside its item`).toBe(true)
    }
    expect(facts.ellipsis).toBe(false)

    // 확인 필요 and 인력 부족 badges: warning text on warning background (BRIEF §3.6).
    expect(facts.badges.map((badge) => badge.status)).toEqual([
      'NEEDS_REVIEW',
      'NEEDS_REVIEW',
      'UNDERSTAFFED',
      'UNDERSTAFFED',
    ])
    for (const badge of facts.badges) {
      expect({ color: badge.color, background: badge.background }, `${badge.status} colours`).toEqual(WARNING)
    }

    // Number tiles (BRIEF §3.6): value 2xl/700, label sm text-muted.
    expect(facts.value).toEqual({ size: '28px', weight: '700' })
    expect(facts.label).toEqual({ size: '14px', color: TEXT_MUTED })

    // Values on the right: their right edges line up in each list.
    expect(new Set(facts.employeeRights).size, 'employee values aligned').toBe(1)
    expect(new Set(facts.departmentRights).size, 'department values aligned').toBe(1)

    expect(facts.sections.map((section) => section.title)).toEqual(LIST_TITLES)
    const [review, short2, employees, departments] = facts.sections
    if (width >= 1024) {
      // Five tiles in one row; lists in two columns.
      expect(new Set(facts.tiles.map((tile) => tile.top)).size, 'tiles in one row').toBe(1)
      expect(review.top).toBe(short2.top)
      expect(employees.top).toBe(departments.top)
      expect(employees.top).toBeGreaterThan(review.top)
      expect(short2.left).toBeGreaterThan(review.left)
    } else {
      // Two tiles a row; lists one under the other.
      const tops = facts.tiles.map((tile) => tile.top)
      expect(tops[0]).toBe(tops[1])
      expect(tops[2]).toBe(tops[3])
      expect(tops[2]).toBeGreaterThan(tops[0])
      expect(tops[4]).toBeGreaterThan(tops[2])
      expect(new Set(facts.sections.map((section) => section.left)).size, 'lists share the left edge').toBe(1)
      expect(short2.top).toBeGreaterThan(review.top)
      expect(employees.top).toBeGreaterThan(short2.top)
      expect(departments.top).toBeGreaterThan(employees.top)
      if (width === 360) {
        for (const tile of facts.tiles) {
          expect(Math.abs(tile.width - 160), `tile width ${tile.width}`).toBeLessThanOrEqual(1)
        }
      }
    }
  })
}

for (const width of [1280, 360]) {
  test(`fixed empty answer shows each list's own empty message at ${width}px`, async ({ page }) => {
    await loginAs(page, PROJECT_MANAGER)
    await stubDashboard(page, (route) => json(route, EMPTY))
    await openAt(page, width)
    await expectDashboard(page)
    await waitForAnswer(page)

    expect(await tiles(page).allTextContents()).toEqual(tileTexts(EMPTY))
    for (const [index, title] of LIST_TITLES.entries()) {
      await expect(region(page, title).getByRole('status')).toContainText(EMPTY_TITLES[index])
    }
    await expect(page.getByRole('alert')).toHaveCount(0)
  })

  test(`a 500 shows — in the tiles and an error in every list; 다시 시도 asks again at ${width}px`, async ({ page }) => {
    await loginAs(page, PROJECT_MANAGER)
    let failed = false
    const requests = await stubDashboard(page, (route) => {
      if (!failed) {
        failed = true
        return json(route, { code: 'X', message: 'x' }, 500)
      }
      return json(route, WITH_ITEMS)
    })
    await openAt(page, width)
    await expectDashboard(page)
    await expect(page.getByRole('alert')).toHaveCount(4)

    expect(await tiles(page).allTextContents()).toEqual([
      '전체 직원—',
      '투입 가능—',
      '투입 불가—',
      '가용 인원—',
      '진행 프로젝트—',
    ])
    for (const title of LIST_TITLES) {
      await expect(region(page, title).getByRole('alert')).toContainText('데이터를 불러오지 못했습니다')
    }
    await expect(page.getByRole('button', { name: '다시 시도' })).toHaveCount(4)
    expect(requests).toHaveLength(1)

    await region(page, '직원별 가용률').getByRole('button', { name: '다시 시도' }).click()
    await expect.poll(() => requests.length).toBe(2)
    await waitForAnswer(page)
    await expect(page.getByRole('alert')).toHaveCount(0)
    expect(await tiles(page).allTextContents()).toEqual(tileTexts(WITH_ITEMS))
  })
}

test('a held answer shows 불러오는 중… until it is released', async ({ page }) => {
  await loginAs(page, PROJECT_MANAGER)
  let held: Route | undefined
  const requests = await stubDashboard(page, async (route) => {
    held = route
  })
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/')
  await page.getByRole('navigation').first().waitFor()
  await expectDashboard(page)

  await expect.poll(() => requests.length).toBe(1)
  expect(held, 'the request reached the page and is held').toBeDefined()
  await expect(page.getByText('불러오는 중…')).toBeVisible()
  expect(await page.locator('main [aria-busy="true"]').count()).toBe(1)
  expect(await tiles(page).count()).toBe(0)

  await json(held!, WITH_ITEMS)
  await waitForAnswer(page)
  expect(await tiles(page).allTextContents()).toEqual(tileTexts(WITH_ITEMS))
})

test('an employee-only account goes to 내 정보 without asking for the dashboard, and the server refuses it', async ({
  page,
}) => {
  const calls: string[] = []
  page.on('request', (request) => {
    if (new URL(request.url()).pathname === '/api/dashboard') calls.push(request.url())
  })
  await loginAs(page, EMPLOYEE_ONLY)
  await page.goto('/')
  await page.waitForURL((url) => url.pathname === '/me')
  await expect(page.getByRole('heading', { name: '내 정보' })).toBeVisible()
  expect(calls).toEqual([])

  expect((await page.request.get('/api/dashboard')).status(), 'employee-only').toBe(403)
  expect((await page.request.post('/api/auth/logout')).status(), 'logout').toBe(204)
  expect((await page.request.get('/api/dashboard')).status(), 'logged out').toBe(401)
})

test('no horizontal overflow with the seed, items, empty lists and the error', async ({ page }) => {
  await loginAs(page, PROJECT_MANAGER)

  await openAt(page, 1280)
  await expectDashboard(page)
  await waitForAnswer(page)
  await expectNoHorizontalOverflow(page, WIDTHS)

  const current: { body: unknown; status: number } = { body: WITH_ITEMS, status: 200 }
  await stubDashboard(page, (route) => json(route, current.body, current.status))

  for (const [body, status] of [
    [WITH_ITEMS, 200],
    [EMPTY, 200],
    [{ code: 'X', message: 'x' }, 500],
  ] as Array<[unknown, number]>) {
    current.body = body
    current.status = status
    await openAt(page, 1280)
    await expectDashboard(page)
    if (status === 200) {
      await waitForAnswer(page)
    } else {
      await expect(page.getByRole('alert')).toHaveCount(4)
    }
    await expectNoHorizontalOverflow(page, WIDTHS)
  }
})
