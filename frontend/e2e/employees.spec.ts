import { expect, test, type Page } from '@playwright/test'
import { DUAL_MANAGER, EMPLOYEE_ONLY, HR_MANAGER, PROJECT_MANAGER, loginAs } from './support/auth'
import {
  LONG_NAME,
  LONG_SKILL,
  SAMPLE,
  expectedRows,
  rowsOf,
  stubEmployees,
  type Employee,
} from './support/employees'
import { expectNoHorizontalOverflow, settle } from './support/layout'
import { json } from './support/projects'

// T#13: the employee list screen. Criterion 9 uses the real seed and compares the screen with the API at the same
// moment (the e2e DB keeps the dates of the day it was made, so rates are not learnt by heart); criteria 10 and 11
// replace GET /api/employees with fixed answers.
const FILTERS = ['부서', '기술', '투입 상태', '가용률']
const BADGE_COLORS: Record<string, { color: string; background: string }> = {
  AVAILABLE: { color: 'rgb(27, 115, 64)', background: 'rgb(231, 244, 236)' },
  UNAVAILABLE: { color: 'rgb(191, 43, 27)', background: 'rgb(252, 235, 232)' },
  NEEDS_REVIEW: { color: 'rgb(143, 83, 0)', background: 'rgb(253, 241, 220)' },
}

async function open(page: Page, width: number, path = '/employees'): Promise<void> {
  await page.setViewportSize({ width, height: 800 })
  await page.goto(path)
  // The app first asks who is logged in (GET /api/auth/me); the shell, with its navigation, comes after that.
  await page.getByRole('navigation').first().waitFor()
  await page.waitForLoadState('networkidle')
  await settle(page)
}

// The screen is there at once: the name search does not wait for any answer.
async function expectScreen(page: Page): Promise<void> {
  expect(await page.getByLabel('이름 검색', { exact: true }).count(), 'name search').toBe(1)
}

const select = (page: Page, label: string) => page.getByLabel(label, { exact: true })

async function apiList(page: Page, search = ''): Promise<Employee[]> {
  const response = await page.request.get(`/api/employees${search}`)
  expect(response.status(), `GET /api/employees${search}`).toBe(200)
  return (await response.json()) as Employee[]
}

// Waits until the address has `search` and the rows are the API's answer to that same query.
async function expectRowsLikeApi(page: Page, search: string): Promise<Employee[]> {
  await expect.poll(() => new URL(page.url()).search).toBe(search)
  const expected = await apiList(page, search)
  await expect.poll(() => rowsOf(page)).toEqual(expectedRows(expected))
  return expected
}

function optionTexts(page: Page, label: string): Promise<string[]> {
  return select(page, label).locator('option').allTextContents()
}

test.describe('the real seed (criterion 9)', () => {
  test('the rows are the API answer, names are plain text, and the choices come from the unfiltered answer', async ({
    page,
  }) => {
    await loginAs(page, HR_MANAGER)
    await open(page, 1280)

    expect(await page.locator('table').count(), 'employee table').toBe(1)
    const all = await apiList(page)
    expect(await rowsOf(page)).toEqual(expectedRows(all))
    await expect(page.getByText(`${all.length}명`, { exact: true })).toBeVisible()
    expect(all.map((employee) => employee.name)).toEqual(expect.arrayContaining(['박소영', '최동훈', '서하윤']))
    expect(await page.locator('tbody a').count(), 'links in the table').toBe(0)

    const skills = [...new Set(all.flatMap((employee) => employee.skills.map((skill) => skill.skillName)))].sort(
      (a, b) => a.localeCompare(b, 'ko'),
    )
    expect(skills).toEqual(expect.arrayContaining(['Java', 'React']))
    expect(await optionTexts(page, '기술')).toEqual(['전체', ...skills])

    // 디자인팀 has nobody with a skill in the seed; the 기술 choices stay as they were.
    const design = all.find((employee) => employee.departmentName === '디자인팀')!.departmentId
    await select(page, '부서').selectOption({ label: '디자인팀' })
    const designRows = await expectRowsLikeApi(page, `?departmentId=${design}`)
    expect(designRows.every((employee) => employee.skills.length === 0)).toBe(true)
    expect(await optionTexts(page, '기술')).toEqual(['전체', ...skills])
  })

  test('each filter chosen on the screen gives the API answer for the same query, also after a reload', async ({
    page,
  }) => {
    await loginAs(page, HR_MANAGER)
    await open(page, 1280)
    expect(await page.locator('table').count(), 'employee table').toBe(1)
    const all = await apiList(page)
    const dev = all.find((employee) => employee.departmentName === '개발팀')!.departmentId

    await select(page, '기술').selectOption('Java')
    await expectRowsLikeApi(page, '?skill=Java')

    await open(page, 1280)
    await select(page, '투입 상태').selectOption({ label: '투입 불가' })
    const unavailable = await expectRowsLikeApi(page, '?status=UNAVAILABLE')
    expect(unavailable.map((employee) => employee.name)).toContain('최동훈')

    await open(page, 1280)
    await select(page, '가용률').selectOption({ label: '50% 이상' })
    const atLeast50 = await expectRowsLikeApi(page, '?minAvailability=50')
    for (const [, , , , , rate] of await rowsOf(page)) {
      expect(Number.parseInt(rate, 10), rate).toBeGreaterThanOrEqual(50)
    }
    expect(atLeast50.length).toBeGreaterThan(0)

    await open(page, 1280)
    await page.getByLabel('이름 검색', { exact: true }).fill('지')
    await expectRowsLikeApi(page, `?name=${encodeURIComponent('지')}`)

    await open(page, 1280)
    await select(page, '부서').selectOption({ label: '개발팀' })
    await select(page, '투입 상태').selectOption({ label: '투입 불가' })
    const combined = await expectRowsLikeApi(page, `?departmentId=${dev}&status=UNAVAILABLE`)
    expect(combined.map((employee) => employee.name)).toContain('최동훈')

    await page.reload()
    await page.waitForLoadState('networkidle')
    await expectRowsLikeApi(page, `?departmentId=${dev}&status=UNAVAILABLE`)
    await expect(select(page, '부서')).toHaveValue(String(dev))
    await expect(select(page, '투입 상태')).toHaveValue('UNAVAILABLE')
  })

  test('values typed into the address that are not choices are treated as 전체 and never sent', async ({ page }) => {
    await loginAs(page, HR_MANAGER)
    const searches: string[] = []
    page.on('request', (request) => {
      const url = new URL(request.url())
      if (url.pathname === '/api/employees') {
        searches.push(url.search)
      }
    })
    await open(page, 1280, '/employees?status=bogus&minAvailability=33')

    expect(await page.locator('table').count(), 'employee table').toBe(1)
    expect(await rowsOf(page)).toEqual(expectedRows(await apiList(page)))
    expect(searches).toEqual([''])
    for (const label of FILTERS) {
      await expect(select(page, label), label).toHaveValue('')
    }
  })

  for (const account of [PROJECT_MANAGER, DUAL_MANAGER]) {
    test(`${account.username} sees the same list`, async ({ page }) => {
      await loginAs(page, account)
      await open(page, 1280)

      expect(await page.locator('table').count(), 'employee table').toBe(1)
      expect(await rowsOf(page)).toEqual(expectedRows(await apiList(page)))
    })
  }

  test('an employee-only account goes to 내 정보, and the server refuses its list request (T#6, regression)', async ({
    page,
  }) => {
    await loginAs(page, EMPLOYEE_ONLY)
    await page.goto('/employees')
    await expect.poll(() => new URL(page.url()).pathname).toBe('/me')
    const response = await page.request.get('/api/employees?status=UNAVAILABLE')
    expect(response.status()).toBe(403)
  })
})

test.describe('fixed answers (criterion 10)', () => {
  for (const width of [1280, 360]) {
    test(`values, badges and long values at ${width}px`, async ({ page }) => {
      await loginAs(page, HR_MANAGER)
      await stubEmployees(page, (route) => json(route, SAMPLE))
      await open(page, width)

      expect(await page.locator('table').count(), 'employee table').toBe(1)
      expect(await rowsOf(page)).toEqual([
        ['박소영', '개발팀', '백엔드 개발자', 'Java, React', '투입 가능', '40%', '—'],
        ['최동훈', '개발팀', '프런트엔드 개발자', '—', '투입 불가', '100%', '확인 필요'],
        [LONG_NAME, '디자인팀', '디자이너', LONG_SKILL, '투입 가능', '0%', '—'],
      ])

      const facts = await page.locator('table').evaluate((table) => {
        const css = (element: Element) => getComputedStyle(element)
        const rows = Array.from(table.querySelectorAll('tbody tr'))
        const textRight = (cell: Element) => {
          const range = document.createRange()
          range.selectNodeContents(cell)
          return range.getBoundingClientRect().right
        }
        const longRow = rows[2].querySelectorAll('td')
        return {
          badges: Array.from(table.querySelectorAll('tbody [data-status]')).map((badge) => ({
            status: badge.getAttribute('data-status'),
            color: css(badge).color,
            background: css(badge).backgroundColor,
          })),
          dashColors: Array.from(table.querySelectorAll('tbody td'))
            .filter((cell) => cell.textContent?.trim() === '—')
            .map((cell) => css(cell.firstElementChild ?? cell).color),
          rateRights: rows.map((row) => Math.round(textRight(row.querySelectorAll('td')[5]))),
          rateCellRights: rows.map((row) => Math.round(row.querySelectorAll('td')[5].getBoundingClientRect().right)),
          rateAlign: rows.map((row) => css(row.querySelectorAll('td')[5]).textAlign),
          rateNumeric: css(rows[0].querySelectorAll('td')[5]).fontVariantNumeric,
          longFits: [longRow[0], longRow[3]].map((cell) => cell.scrollWidth <= cell.clientWidth),
        }
      })

      expect(facts.badges.map((badge) => badge.status)).toEqual(['AVAILABLE', 'UNAVAILABLE', 'NEEDS_REVIEW', 'AVAILABLE'])
      for (const badge of facts.badges) {
        expect({ color: badge.color, background: badge.background }, `${badge.status} colours`).toEqual(
          BADGE_COLORS[badge.status ?? ''],
        )
      }
      expect(facts.dashColors.length).toBeGreaterThan(0)
      expect(new Set(facts.dashColors)).toEqual(new Set(['rgb(85, 96, 110)']))
      expect(facts.rateAlign).toEqual(['end', 'end', 'end'])
      expect(facts.rateNumeric).toContain('tabular-nums')
      if (width === 1280) {
        // The rate column's numbers end at the same x (BRIEF Checks 7).
        expect(new Set(facts.rateRights).size, `right edges ${facts.rateRights.join(', ')}`).toBe(1)
      } else {
        // In a card the value sits at the right end of its line (BRIEF §3.3).
        facts.rateRights.forEach((right, index) => {
          expect(Math.abs(right - facts.rateCellRights[index]), `card ${index} rate`).toBeLessThanOrEqual(1)
        })
      }
      expect(facts.longFits, '48-character name and skill wrap inside their cells').toEqual([true, true])
    })

    test(`empty, no results and error at ${width}px`, async ({ page }) => {
      await loginAs(page, HR_MANAGER)
      let mode: 'empty' | 'filtered-empty' | 'error' | 'list' = 'empty'
      const requests = await stubEmployees(page, (route, search) => {
        if (mode === 'error') return json(route, { code: 'X', message: 'x' }, 500)
        if (mode === 'filtered-empty') return json(route, search ? [] : SAMPLE)
        return json(route, mode === 'list' ? SAMPLE : [])
      })

      await open(page, width)
      await expectScreen(page)
      await expect(page.getByText('등록된 직원이 없습니다', { exact: true })).toBeVisible()
      expect(await page.getByRole('button', { name: '필터 초기화' }).count()).toBe(0)

      mode = 'filtered-empty'
      await open(page, width, '/employees?status=UNAVAILABLE')
      await expect(page.getByText('조건에 맞는 직원이 없습니다', { exact: true })).toBeVisible()
      await page.getByRole('button', { name: '필터 초기화' }).click()
      await expect.poll(() => new URL(page.url()).search).toBe('')
      await expect(page.locator('tbody tr')).toHaveCount(SAMPLE.length)

      mode = 'error'
      requests.length = 0
      await open(page, width)
      await expect(page.getByRole('alert')).toBeVisible()
      await expect(page.getByText('데이터를 불러오지 못했습니다', { exact: true })).toBeVisible()
      mode = 'list'
      await page.getByRole('button', { name: '다시 시도' }).click()
      await expect(page.locator('tbody tr')).toHaveCount(SAMPLE.length)
      expect(requests).toEqual(['/api/employees', '/api/employees'])
    })
  }

  test('an older answer that arrives late does not replace the answer to the last filter', async ({ page }) => {
    await loginAs(page, HR_MANAGER)
    let release: () => void = () => undefined
    const held = new Promise<void>((resolve) => {
      release = resolve
    })
    let heldReached = false
    let heldHandled = false
    const requests = await stubEmployees(page, async (route, search) => {
      if (search === '?status=UNAVAILABLE') {
        heldReached = true
        await held
        heldHandled = true
        // The page may have cancelled this request already; a late answer to it must not matter either way.
        await json(route, [SAMPLE[1]]).catch(() => undefined)
        return
      }
      await json(route, search === '?status=AVAILABLE' ? [SAMPLE[0]] : SAMPLE)
    })
    await open(page, 1280)
    await expectScreen(page)

    await select(page, '투입 상태').selectOption('UNAVAILABLE')
    await expect.poll(() => heldReached).toBe(true)
    expect(heldHandled, 'the first request is still held').toBe(false)
    await select(page, '투입 상태').selectOption('AVAILABLE')
    await expect.poll(() => rowsOf(page)).toEqual(expectedRows([SAMPLE[0]]))

    release()
    await expect.poll(() => heldHandled).toBe(true)
    await page.waitForTimeout(300)
    expect(await rowsOf(page)).toEqual(expectedRows([SAMPLE[0]]))
    await expect(select(page, '투입 상태')).toHaveValue('AVAILABLE')
    expect(requests).toEqual(['/api/employees', '/api/employees?status=UNAVAILABLE', '/api/employees?status=AVAILABLE'])
  })
})

test.describe('look and widths (criterion 11)', () => {
  test('the select boxes, the four filters on one line, and the 필터 button below 1024px', async ({ page }) => {
    await loginAs(page, HR_MANAGER)
    await stubEmployees(page, (route) => json(route, SAMPLE))
    await open(page, 1280)
    await expectScreen(page)

    const styles = await page.evaluate((labels) => {
      return labels.map((text) => {
        const label = Array.from(document.querySelectorAll('label')).find((element) => element.textContent === text)!
        const control = document.getElementById(label.htmlFor)!
        const css = getComputedStyle(control)
        return {
          tag: control.tagName,
          height: control.getBoundingClientRect().height,
          border: `${css.borderTopWidth} ${css.borderTopStyle} ${css.borderTopColor}`,
          label: `${getComputedStyle(label).fontSize}/${getComputedStyle(label).fontWeight}`,
        }
      })
    }, FILTERS)
    for (const style of styles) {
      expect(style).toEqual({ tag: 'SELECT', height: 40, border: '1px solid rgb(125, 135, 150)', label: '14px/600' })
    }

    const toggle = page.getByRole('button', { name: /^필터/ })
    const boxes = async () =>
      Promise.all(FILTERS.map(async (label) => (await select(page, label).boundingBox()) ?? null))

    for (const [width, each] of [
      [1280, 240],
      [1024, 176],
    ] as const) {
      await page.setViewportSize({ width, height: 800 })
      await settle(page)
      const rects = await boxes()
      expect(new Set(rects.map((rect) => Math.round(rect!.y))).size, `${width}px: one line`).toBe(1)
      for (const rect of rects) {
        expect(Math.abs(rect!.width - each), `${width}px: filter width ${rect!.width}`).toBeLessThanOrEqual(1)
      }
      await expect(toggle, `${width}px: no 필터 button`).toBeHidden()
      expect(await page.locator('table').evaluate((table) => getComputedStyle(table).display)).toBe('table')
      await expect(page.locator('thead')).toBeVisible()
    }

    for (const width of [1023, 360]) {
      await page.setViewportSize({ width, height: 800 })
      await settle(page)
      await expect(toggle, `${width}px: 필터 button`).toBeVisible()
      await expect(toggle).toHaveAttribute('aria-expanded', 'false')
      for (const label of FILTERS) {
        await expect(select(page, label), `${width}px: ${label} folded`).toBeHidden()
      }
      expect(await page.locator('table').evaluate((table) => getComputedStyle(table).display)).toBe('block')

      await toggle.click()
      await settle(page)
      const rects = await boxes()
      const content = width - 32
      for (let index = 0; index < rects.length; index += 1) {
        const rect = rects[index]!
        expect(Math.abs(rect.width - content), `${width}px: ${FILTERS[index]} width ${rect.width}`).toBeLessThanOrEqual(1)
        expect(Math.round(rect.x), `${width}px: ${FILTERS[index]} left`).toBe(Math.round(rects[0]!.x))
        if (index > 0) {
          expect(rect.y, `${width}px: ${FILTERS[index]} under ${FILTERS[index - 1]}`).toBeGreaterThan(rects[index - 1]!.y)
        }
      }
      await toggle.click()
      await expect(toggle).toHaveAttribute('aria-expanded', 'false')
    }
  })

  test('the spinner is 24px while the answer is held and stops for reduced motion', async ({ page }) => {
    await loginAs(page, HR_MANAGER)
    let release: () => void = () => undefined
    const held = new Promise<void>((resolve) => {
      release = resolve
    })
    let heldReached = false
    await stubEmployees(page, async (route) => {
      heldReached = true
      await held
      await json(route, SAMPLE).catch(() => undefined)
    })
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto('/employees')
    await page.getByRole('navigation').first().waitFor()
    await expectScreen(page)
    await expect.poll(() => heldReached).toBe(true)

    const spinner = page.getByTestId('spinner')
    await expect(spinner).toBeVisible()
    await expect(page.getByText('불러오는 중…', { exact: true })).toBeVisible()
    // The layout size: the turning transform would make the drawn box of a rotated square larger.
    const size = await spinner.evaluate((element) => [(element as HTMLElement).offsetWidth, (element as HTMLElement).offsetHeight])
    expect(size).toEqual([24, 24])
    expect(await spinner.evaluate((element) => getComputedStyle(element).animationName)).not.toBe('none')
    await page.emulateMedia({ reducedMotion: 'reduce' })
    expect(await spinner.evaluate((element) => getComputedStyle(element).animationName)).toBe('none')

    release()
    await expect(page.locator('tbody tr')).toHaveCount(SAMPLE.length)
  })

  test('no sideways scroll at 1280, 1024, 1023 and 360px for the list, the open filters and the three states', async ({
    page,
  }) => {
    await loginAs(page, HR_MANAGER)
    let mode: 'list' | 'empty' | 'filtered-empty' | 'error' = 'list'
    await stubEmployees(page, (route, search) => {
      if (mode === 'error') return json(route, { code: 'X', message: 'x' }, 500)
      if (mode === 'filtered-empty') return json(route, search ? [] : SAMPLE)
      return json(route, mode === 'empty' ? [] : SAMPLE)
    })
    const widths = [1280, 1024, 1023, 360]

    await open(page, 1280)
    expect(await page.locator('table').count(), 'employee table').toBe(1)
    await expectNoHorizontalOverflow(page, widths)

    // The filters opened at 360px (the open state stays when the width changes).
    await page.setViewportSize({ width: 360, height: 800 })
    await page.getByRole('button', { name: /^필터/ }).click()
    await expect(select(page, '부서')).toBeVisible()
    await expectNoHorizontalOverflow(page, widths)

    for (const next of ['empty', 'error'] as const) {
      mode = next
      await open(page, 1280)
      await expect(page.locator(next === 'empty' ? '[role="status"]' : '[role="alert"]')).toBeVisible()
      await expectNoHorizontalOverflow(page, widths)
    }
    mode = 'filtered-empty'
    await open(page, 1280, '/employees?status=UNAVAILABLE')
    await expect(page.getByText('조건에 맞는 직원이 없습니다', { exact: true })).toBeVisible()
    await expectNoHorizontalOverflow(page, widths)
  })
})
