import { expect, test, type APIRequestContext, type Page, type Route } from '@playwright/test'
import { DUAL_MANAGER, EMPLOYEE_ONLY, HR_MANAGER, PROJECT_MANAGER, loginAs, type DemoAccount } from './support/auth'
import { expectNoHorizontalOverflow, settle } from './support/layout'
import { json } from './support/projects'

// T#38: the employee detail (/employees/:id), 내 정보 (/me) and the list's detail links. Criterion 7 uses the real seed
// and compares the screen with the API at the same moment (the e2e DB keeps the dates of the day it was made, so values
// are not learnt by heart); criterion 9 replaces GET /api/employees/9001 with fixed answers; criterion 8 is the T#6
// and T#28 behaviour that already held before this task (regression).

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
  assignments: Array<{
    projectId: number
    projectName: string
    projectStatus: 'PLANNED' | 'IN_PROGRESS' | 'DONE' | 'ON_HOLD'
    startDate: string
    endDate: string
    allocationPercent: number
  }>
  today: string
}

const LEVELS = { BEGINNER: '초급', INTERMEDIATE: '중급', ADVANCED: '고급' } as const
const STATUSES = { AVAILABLE: '투입 가능', UNAVAILABLE: '투입 불가' } as const
const LONG = 'abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJKL'
const FIXED_ID = 9001
const TEXT_MUTED = 'rgb(85, 96, 110)'

const pathOf = (page: Page) => new URL(page.url()).pathname

async function open(page: Page, width: number, path: string): Promise<void> {
  await page.setViewportSize({ width, height: 800 })
  await page.goto(path)
  // The app first asks who is logged in (GET /api/auth/me); the shell, with its navigation, comes after that.
  await page.getByRole('navigation').first().waitFor()
  await page.waitForLoadState('networkidle')
  await settle(page)
}

// Employee ids by name, read as a manager in a separate request context (the page keeps its own login).
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

async function apiGet<T>(page: Page, path: string): Promise<T> {
  const response = await page.request.get(path)
  expect(response.status(), `GET ${path}`).toBe(200)
  return (await response.json()) as T
}

// What the screen should show for a detail (contract "상세").
function expectedView(detail: Detail) {
  return {
    name: detail.name,
    badges: [STATUSES[detail.availabilityStatus], ...(detail.needsReview ? ['확인 필요'] : [])],
    availability: `${detail.currentAvailability}%`,
    info: [
      detail.departmentName,
      detail.jobTitle,
      `${detail.careerYears}년`,
      detail.unavailableReason ?? '—',
      detail.unavailableUntil ?? '—',
    ],
    skills: detail.skills.map((skill) => `${skill.skillName} · ${LEVELS[skill.proficiencyLevel]}`),
    rows: detail.assignments.map((a) => [a.projectName, `${a.startDate} ~ ${a.endDate}`, `${a.allocationPercent}%`]),
    bars: detail.assignments.map((a) => `${a.projectName}, ${a.startDate} ~ ${a.endDate}, ${a.allocationPercent}%`),
  }
}

// What the screen shows inside <main>, read from the DOM.
function viewOf(page: Page, heading: 'h1' | 'h2' = 'h1') {
  return page.locator('main').evaluate((main, headingTag) => {
    const text = (element: Element | null) => (element?.textContent ?? '').trim()
    return {
      name: text(main.querySelector(`${headingTag}[data-testid="employee-name"]`)),
      badges: Array.from(main.querySelectorAll('.badge[data-status]')).map(text),
      availability: text(main.querySelector('[data-testid="current-availability"]')),
      info: Array.from(main.querySelectorAll('dl dd')).map(text),
      skills: Array.from(main.querySelectorAll('ul li')).map(text),
      rows: Array.from(main.querySelectorAll('tbody tr')).map((row) => Array.from(row.querySelectorAll('td')).map(text)),
      bars: Array.from(main.querySelectorAll('[data-testid="gantt-bar"]')).map((bar) => bar.getAttribute('aria-label')),
    }
  }, heading)
}

function fixedDetail(overrides: Partial<Detail> = {}): Detail {
  return {
    id: FIXED_ID,
    name: '고정 직원',
    departmentId: 1,
    departmentName: '개발팀',
    jobTitle: '개발자',
    careerYears: 3,
    availabilityStatus: 'AVAILABLE',
    unavailableReason: null,
    unavailableUntil: null,
    currentAvailability: 40,
    needsReview: false,
    skills: [{ skillName: 'Java', proficiencyLevel: 'ADVANCED' }],
    assignments: [
      {
        projectId: 1,
        projectName: '알파 프로젝트',
        projectStatus: 'IN_PROGRESS',
        startDate: '2026-09-01',
        endDate: '2026-11-30',
        allocationPercent: 60,
      },
    ],
    today: '2026-10-13',
    ...overrides,
  }
}

// Replaces GET /api/employees/9001. The list returned records every request that reached the page.
async function stubDetail(page: Page, handler: (route: Route) => Promise<void>): Promise<string[]> {
  const requests: string[] = []
  await page.route(
    (url) => url.pathname === `/api/employees/${FIXED_ID}`,
    (route) => {
      requests.push(route.request().method())
      return handler(route)
    },
  )
  return requests
}

async function openFixed(page: Page, width: number, detail: Detail): Promise<void> {
  await loginAs(page, HR_MANAGER)
  await stubDetail(page, (route) => json(route, detail))
  await open(page, width, `/employees/${FIXED_ID}`)
  expect(await page.getByRole('heading', { level: 1, name: detail.name }).count(), 'employee heading').toBe(1)
}

test.describe('the real seed (criterion 7)', () => {
  test('the detail of 박소영 is the API answer at the same moment', async ({ page, request }) => {
    const ids = await idsByName(request)
    await loginAs(page, HR_MANAGER)
    await open(page, 1280, `/employees/${ids['박소영']}`)

    expect(await page.getByRole('heading', { level: 1, name: '박소영' }).count(), 'employee heading').toBe(1)
    const detail = await apiGet<Detail>(page, `/api/employees/${ids['박소영']}`)
    expect(await viewOf(page)).toEqual(expectedView(detail))
    expect(detail.skills.length, 'seeded skills').toBeGreaterThan(0)
    expect(detail.assignments.length, 'seeded assignments').toBeGreaterThan(0)
  })

  test('each name in the list links to its detail, and following 박소영 opens it', async ({ page }) => {
    await loginAs(page, HR_MANAGER)
    await open(page, 1280, '/employees')

    const links = page.locator('tbody a')
    const all = await apiGet<Array<{ id: number; name: string }>>(page, '/api/employees')
    expect(await links.count(), 'links in the table').toBe(all.length)
    expect(await links.evaluateAll((anchors) => anchors.map((a) => [a.textContent, a.getAttribute('href')]))).toEqual(
      all.map((employee) => [employee.name, `/employees/${employee.id}`]),
    )

    const park = all.find((employee) => employee.name === '박소영')!
    await page.getByRole('link', { name: '박소영', exact: true }).click()
    await expect.poll(() => pathOf(page)).toBe(`/employees/${park.id}`)
    await expect(page.getByRole('heading', { level: 1, name: '박소영' })).toBeVisible()
  })

  test('최동훈 is unavailable, with the reason, the end date and 확인 필요 of the API', async ({ page, request }) => {
    const ids = await idsByName(request)
    await loginAs(page, HR_MANAGER)
    await open(page, 1280, `/employees/${ids['최동훈']}`)

    expect(await page.getByRole('heading', { level: 1, name: '최동훈' }).count(), 'employee heading').toBe(1)
    const detail = await apiGet<Detail>(page, `/api/employees/${ids['최동훈']}`)
    expect(detail.availabilityStatus).toBe('UNAVAILABLE')
    expect(detail.unavailableReason).toBe('육아휴직')
    expect(await viewOf(page)).toEqual(expectedView(detail))
  })

  test('이수민 has no assignment: one empty state and no table', async ({ page, request }) => {
    const ids = await idsByName(request)
    await loginAs(page, HR_MANAGER)
    await open(page, 1280, `/employees/${ids['이수민']}`)

    expect(await page.getByRole('heading', { level: 1, name: '이수민' }).count(), 'employee heading').toBe(1)
    const detail = await apiGet<Detail>(page, `/api/employees/${ids['이수민']}`)
    expect(detail.assignments).toEqual([])
    await expect(page.getByText('배치된 프로젝트가 없습니다', { exact: true })).toBeVisible()
    expect(await page.locator('main table').count(), 'assignment table').toBe(0)
    expect(await viewOf(page)).toEqual(expectedView(detail))
  })

  test('내 정보 of employee.demo is GET /api/me/employee, read-only', async ({ page }) => {
    await loginAs(page, EMPLOYEE_ONLY)
    await open(page, 1280, '/me')

    expect(await page.getByRole('heading', { level: 2, name: '한지우' }).count(), 'own name').toBe(1)
    await expect(page.getByRole('heading', { level: 1, name: '내 정보' })).toBeVisible()
    const mine = await apiGet<Detail>(page, '/api/me/employee')
    expect(await viewOf(page, 'h2')).toEqual(expectedView(mine))
    expect(await page.locator('main button').count(), 'buttons').toBe(0)
  })

  for (const account of [PROJECT_MANAGER, DUAL_MANAGER] as DemoAccount[]) {
    test(`${account.username} sees the same detail of 박소영`, async ({ page, request }) => {
      const ids = await idsByName(request)
      await loginAs(page, account)
      await open(page, 1280, `/employees/${ids['박소영']}`)

      expect(await page.getByRole('heading', { level: 1, name: '박소영' }).count(), 'employee heading').toBe(1)
      const detail = await apiGet<Detail>(page, `/api/employees/${ids['박소영']}`)
      expect(await viewOf(page)).toEqual(expectedView(detail))
      expect(await page.locator('main button').count(), 'buttons').toBe(0)
    })
  }
})

test.describe('roles and addresses (criterion 8, regression)', () => {
  test('an employee-only account goes to 내 정보 from any employee address, and the server refuses it', async ({
    page,
    request,
  }) => {
    const ids = await idsByName(request)
    await loginAs(page, EMPLOYEE_ONLY)

    for (const name of ['박소영', '한지우']) {
      await page.goto(`/employees/${ids[name]}`)
      await expect.poll(() => pathOf(page), `/employees/<${name}>`).toBe('/me')
    }

    for (const name of ['박소영', '한지우']) {
      const other = await page.request.get(`/api/employees/${ids[name]}`)
      expect(other.status(), `GET /api/employees/<${name}>`).toBe(403)
      expect((await other.json()).code).toBe('AUTH_FORBIDDEN')
    }
    const write = await page.request.put('/api/me/employee', { data: {} })
    expect(write.status(), 'PUT /api/me/employee').toBe(403)
    const mine = await page.request.get(`/api/me/employee?id=${ids['박소영']}`)
    expect(mine.status()).toBe(200)
    expect((await mine.json()).name).toBe('한지우')
  })

  test('a logged-out visitor goes to the login form from an employee address', async ({ page, request }) => {
    const ids = await idsByName(request)

    await page.goto(`/employees/${ids['박소영']}`)

    await expect.poll(() => pathOf(page)).toBe('/login')
  })
})

test.describe('fixed answers (criterion 9)', () => {
  test('the today line follows the server date of the answer, not the browser date', async ({ page }) => {
    const winter = [
      {
        projectId: 1,
        projectName: '알파 프로젝트',
        projectStatus: 'IN_PROGRESS' as const,
        startDate: '2030-01-01',
        endDate: '2030-02-28',
        allocationPercent: 50,
      },
    ]
    await openFixed(page, 1280, fixedDetail({ assignments: winter, today: '2030-01-15' }))
    expect(await page.getByText('오늘', { exact: true }).count(), 'today label').toBe(1)
    // The Gantt draws the today line through every row's track (T#12).
    expect(await page.getByTestId('gantt-today-line').count(), 'today line').toBeGreaterThan(0)

    await page.unrouteAll()
    await stubDetail(page, (route) => json(route, fixedDetail({ assignments: winter, today: '2029-12-01' })))
    await open(page, 1280, `/employees/${FIXED_ID}`)
    expect(await page.getByRole('heading', { level: 1, name: '고정 직원' }).count(), 'employee heading').toBe(1)
    expect(await page.getByText('오늘', { exact: true }).count(), 'today label').toBe(0)
    expect(await page.getByTestId('gantt-today-line').count(), 'today line').toBe(0)
  })

  for (const width of [1280, 360]) {
    test(`formats, the rate column and long values at ${width}px`, async ({ page }) => {
      const rates = [5, 60, 100]
      await openFixed(
        page,
        width,
        fixedDetail({
          name: LONG,
          jobTitle: LONG,
          careerYears: 10,
          currentAvailability: 0,
          availabilityStatus: 'UNAVAILABLE',
          unavailableReason: LONG,
          skills: [{ skillName: LONG, proficiencyLevel: 'BEGINNER' }],
          assignments: rates.map((rate, index) => ({
            projectId: index + 1,
            projectName: index === 0 ? LONG : `프로젝트 ${index + 1}`,
            projectStatus: 'IN_PROGRESS' as const,
            startDate: `2026-0${index + 1}-01`,
            endDate: `2026-0${index + 1}-20`,
            allocationPercent: rate,
          })),
        }),
      )

      const view = await viewOf(page)
      expect(view.availability).toBe('0%')
      expect(view.info).toEqual(['개발팀', LONG, '10년', LONG, '—'])
      expect(view.skills).toEqual([`${LONG} · 초급`])
      expect(view.rows.map((row) => row[2])).toEqual(['5%', '60%', '100%'])

      const facts = await page.locator('main').evaluate((main) => {
        const css = (element: Element) => getComputedStyle(element)
        const textRight = (cell: Element) => {
          const range = document.createRange()
          range.selectNodeContents(cell)
          return range.getBoundingClientRect().right
        }
        const rateCells = Array.from(main.querySelectorAll('tbody tr')).map((row) => row.querySelectorAll('td')[2])
        const fits = (element: Element) => element.scrollWidth <= element.clientWidth
        const dash = Array.from(main.querySelectorAll('dl dd')).find((dd) => dd.textContent?.trim() === '—')!
        return {
          rateAlign: rateCells.map((cell) => css(cell).textAlign),
          rateNumeric: css(rateCells[0]).fontVariantNumeric,
          rateRights: rateCells.map((cell) => Math.round(textRight(cell))),
          rateCellRights: rateCells.map((cell) => Math.round(cell.getBoundingClientRect().right)),
          dashColor: css(dash.firstElementChild ?? dash).color,
          longFits: [
            main.querySelector('h1')!,
            ...Array.from(main.querySelectorAll('dl dd')),
            ...Array.from(main.querySelectorAll('ul li')),
            ...Array.from(main.querySelectorAll('tbody td')),
            ...Array.from(main.querySelectorAll('[data-testid="gantt-head"]')),
          ].map((element) => [element.textContent?.slice(0, 12), fits(element)]),
        }
      })
      expect(facts.rateAlign).toEqual(['end', 'end', 'end'])
      expect(facts.rateNumeric).toContain('tabular-nums')
      if (width === 1280) {
        expect(new Set(facts.rateRights).size, `right edges ${facts.rateRights.join(', ')}`).toBe(1)
      } else {
        facts.rateRights.forEach((right, index) => {
          expect(Math.abs(right - facts.rateCellRights[index]), `card ${index} rate`).toBeLessThanOrEqual(1)
        })
      }
      expect(facts.dashColor).toBe(TEXT_MUTED)
      for (const [name, fits] of facts.longFits) {
        expect(fits, `${name} wraps inside its box`).toBe(true)
      }
    })

    test(`the Gantt of overlapping assignments keeps its text under the bars and inside the track at ${width}px`, async ({
      page,
    }) => {
      await openFixed(
        page,
        width,
        fixedDetail({
          today: '2026-04-15',
          assignments: [
            {
              projectId: 1,
              projectName: '알파 프로젝트',
              projectStatus: 'IN_PROGRESS',
              startDate: '2026-01-05',
              endDate: '2026-06-30',
              allocationPercent: 50,
            },
            {
              projectId: 2,
              projectName: '감마 프로젝트',
              projectStatus: 'DONE',
              startDate: '2026-03-01',
              endDate: '2026-03-31',
              allocationPercent: 30,
            },
            {
              projectId: 3,
              projectName: LONG,
              projectStatus: 'IN_PROGRESS',
              startDate: '2026-05-01',
              endDate: '2026-05-20',
              allocationPercent: 20,
            },
          ],
        }),
      )

      const facts = await page.getByTestId('gantt').evaluate((root) => {
        const rect = (element: Element) => {
          const r = element.getBoundingClientRect()
          return { left: r.left, right: r.right, top: r.top, bottom: r.bottom }
        }
        return {
          bars: Array.from(root.querySelectorAll('[data-testid="gantt-bar"]')).map((bar) => bar.textContent),
          overlaps: Array.from(root.querySelectorAll('[data-testid="gantt-overlap"]')).map((band) =>
            band.getAttribute('aria-label'),
          ),
          texts: Array.from(root.querySelectorAll('[data-gantt-text]')).map((text) => ({
            name: text.textContent,
            rect: rect(text),
            track: rect(text.closest('.gantt__track')!),
            ellipsis: getComputedStyle(text).textOverflow === 'ellipsis',
          })),
        }
      })

      expect(facts.bars).toEqual(['', '', ''])
      expect(facts.overlaps).toEqual(['2026-03-01 ~ 2026-03-31, 합계 80%', '2026-05-01 ~ 2026-05-20, 합계 70%'])
      expect(facts.texts.length).toBeGreaterThan(5)
      for (const text of facts.texts) {
        expect(text.rect.left, `${text.name}: left edge`).toBeGreaterThanOrEqual(text.track.left - 1)
        expect(text.rect.right, `${text.name}: right edge`).toBeLessThanOrEqual(text.track.right + 1)
        expect(text.ellipsis, `${text.name}: ellipsis`).toBe(false)
      }
      for (let i = 0; i < facts.texts.length; i += 1) {
        for (let j = i + 1; j < facts.texts.length; j += 1) {
          const a = facts.texts[i].rect
          const b = facts.texts[j].rect
          const overlaps =
            a.left < b.right - 0.5 && b.left < a.right - 0.5 && a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5
          expect(overlaps, `"${facts.texts[i].name}" overlaps "${facts.texts[j].name}"`).toBe(false)
        }
      }
    })
  }

  test('loading, error with 다시 시도, and not found', async ({ page }) => {
    await loginAs(page, HR_MANAGER)
    const held: Route[] = []
    const requests = await stubDetail(page, async (route) => {
      held.push(route)
    })
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto(`/employees/${FIXED_ID}`)
    await page.getByRole('navigation').first().waitFor()
    expect(pathOf(page), 'address').toBe(`/employees/${FIXED_ID}`)

    // Loading: the request is really held until the test lets it go.
    await expect.poll(() => held.length).toBe(1)
    await expect(page.getByText('불러오는 중…', { exact: true })).toBeVisible()
    await expect(page.locator('main [aria-busy="true"]')).toHaveCount(1)
    await json(held[0], fixedDetail())
    await expect(page.getByRole('heading', { level: 1, name: '고정 직원' })).toBeVisible()

    // Error, then 다시 시도 asks again and shows the detail.
    await page.unrouteAll()
    let calls = 0
    await stubDetail(page, (route) => {
      calls += 1
      return calls === 1 ? json(route, { code: 'X', message: '서버 오류' }, 500) : json(route, fixedDetail())
    })
    await open(page, 1280, `/employees/${FIXED_ID}`)
    await expect(page.getByRole('alert')).toBeVisible()
    await page.getByRole('button', { name: '다시 시도' }).click()
    await expect(page.getByRole('heading', { level: 1, name: '고정 직원' })).toBeVisible()
    expect(calls).toBe(2)

    // Not found.
    await page.unrouteAll()
    await stubDetail(page, (route) =>
      json(route, { code: 'EMPLOYEE_NOT_FOUND', message: '직원을 찾을 수 없습니다.' }, 404),
    )
    await open(page, 1280, `/employees/${FIXED_ID}`)
    await expect(page.getByRole('alert')).toContainText('직원을 찾을 수 없습니다.')
    expect(requests.length).toBe(1)
  })
})

test.describe('look and widths (criterion 10)', () => {
  test('the assignment table is a table from 1024px and cards below', async ({ page, request }) => {
    const ids = await idsByName(request)
    await loginAs(page, HR_MANAGER)
    await open(page, 1024, `/employees/${ids['박소영']}`)
    expect(await page.getByRole('heading', { level: 1, name: '박소영' }).count(), 'employee heading').toBe(1)

    await expect(page.locator('main thead')).toBeVisible()
    expect(await page.locator('main table').evaluate((table) => getComputedStyle(table).display)).toBe('table')

    await page.setViewportSize({ width: 1023, height: 800 })
    await settle(page)
    // Cards: the header row is kept only for screen readers (clipped to 1px, T#4 DataTable) and each row is a card.
    const cards = await page.locator('main table').evaluate((table) => ({
      display: getComputedStyle(table).display,
      headWidth: table.querySelector('thead')!.getBoundingClientRect().width,
      rows: Array.from(table.querySelectorAll('tbody tr')).map((row) => getComputedStyle(row).display),
    }))
    expect(cards.display).toBe('block')
    expect(cards.headWidth).toBeLessThanOrEqual(1)
    expect(new Set(cards.rows)).toEqual(new Set(['flex']))
  })

  test('no screen of this task scrolls sideways at 1280, 1024, 1023 and 360px', async ({ page, request }) => {
    const widths = [1280, 1024, 1023, 360]
    const ids = await idsByName(request)
    await loginAs(page, HR_MANAGER)

    for (const name of ['박소영', '이수민']) {
      await open(page, 1280, `/employees/${ids[name]}`)
      expect(await page.getByRole('heading', { level: 1, name }).count(), `${name} heading`).toBe(1)
      await expectNoHorizontalOverflow(page, widths)
    }

    await open(page, 1280, '/employees')
    expect(await page.locator('tbody a').count(), 'detail links').toBeGreaterThan(0)
    await expectNoHorizontalOverflow(page, widths)

    await stubDetail(page, (route) =>
      json(
        route,
        fixedDetail({
          name: LONG,
          jobTitle: LONG,
          unavailableReason: LONG,
          skills: [{ skillName: LONG, proficiencyLevel: 'ADVANCED' }],
        }),
      ),
    )
    await open(page, 1280, `/employees/${FIXED_ID}`)
    expect(await page.getByRole('heading', { level: 1, name: LONG }).count(), 'long heading').toBe(1)
    await expectNoHorizontalOverflow(page, widths)

    await page.unrouteAll()
    await stubDetail(page, (route) => json(route, { code: 'X', message: '서버 오류' }, 500))
    await open(page, 1280, `/employees/${FIXED_ID}`)
    await expect(page.getByRole('alert')).toBeVisible()
    await expectNoHorizontalOverflow(page, widths)
  })

  test('내 정보 does not scroll sideways at 1280, 1024, 1023 and 360px', async ({ page }) => {
    await loginAs(page, EMPLOYEE_ONLY)
    await open(page, 1280, '/me')
    expect(await page.getByRole('heading', { level: 2, name: '한지우' }).count(), 'own name').toBe(1)
    await expectNoHorizontalOverflow(page, [1280, 1024, 1023, 360])
  })
})
