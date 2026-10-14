import { expect, test, type Page } from '@playwright/test'
import { PROJECT_MANAGER, loginAs } from './support/auth'
import { expectNoHorizontalOverflow, settle } from './support/layout'
import { LONG_NAME, SAMPLE, json, stubProjects } from './support/projects'

// T#15: the project list screen. Criterion 7 uses the real seed; 8 and 9 replace GET /api/projects.
const BADGE_COLORS: Record<string, { color: string; background: string }> = {
  IN_PROGRESS: { color: 'rgb(41, 82, 204)', background: 'rgb(238, 241, 245)' },
  DONE: { color: 'rgb(27, 115, 64)', background: 'rgb(231, 244, 236)' },
  PLANNED: { color: 'rgb(85, 96, 110)', background: 'rgb(238, 241, 245)' },
  ON_HOLD: { color: 'rgb(143, 83, 0)', background: 'rgb(253, 241, 220)' },
}
const SEEDED = ['알파 프로젝트', '감마 프로젝트', '베타 프로젝트', '델타 프로젝트', '엡실론 프로젝트']

async function open(page: Page, width: number, path = '/projects'): Promise<void> {
  await page.setViewportSize({ width, height: 800 })
  await page.goto(path)
  // The app first asks who is logged in (GET /api/auth/me); the shell, with its navigation, comes after that.
  await page.getByRole('navigation').first().waitFor()
  await settle(page)
}

const filter = (page: Page) => page.getByRole('group', { name: '상태 필터' })

// Where the pieces of the first row's period sit: the top of the first date, of the "~", and of the second date.
async function periodLines(page: Page) {
  return page.locator('tbody tr').first().evaluate((element) => {
    const periodCell = element.querySelectorAll('td')[2]
    const dates = periodCell.querySelectorAll('.project-list__date')
    const between = dates[0].nextSibling as Text
    const topOf = (node: Node, index: number) => {
      const range = document.createRange()
      range.setStart(node, index)
      range.setEnd(node, index + 1)
      return range.getBoundingClientRect().top
    }
    const endText = dates[1].firstChild as Text
    return {
      first: topOf(dates[0].firstChild!, 0),
      tilde: topOf(between, between.data.indexOf('~')),
      second: topOf(endText, 0),
      dateRects: Array.from(dates).map((date) => date.getClientRects().length),
    }
  })
}

for (const width of [1280, 360]) {
  test(`project list with the seed at ${width}px`, async ({ page }) => {
    await loginAs(page, PROJECT_MANAGER)
    await open(page, width)

    // The screen has the status filter at once (also while loading); the table follows the answer.
    expect(await filter(page).count(), 'status filters').toBe(1)
    await expect(page.locator('table')).toHaveCount(1)
    await expect(page.getByRole('link', { name: SEEDED[0] })).toBeVisible()

    const facts = await page.evaluate(() => {
      const css = (element: Element) => getComputedStyle(element)
      const table = document.querySelector('table')!
      const rows = Array.from(table.querySelectorAll('tbody tr'))
      const group = document.querySelector('[role="group"][aria-label="상태 필터"]')!
      const buttons = Array.from(group.querySelectorAll('button'))
      return {
        headings: Array.from(document.querySelectorAll('h1')).map((h) => h.textContent),
        headers: Array.from(table.querySelectorAll('th')).map((th) => [th.textContent, th.getAttribute('scope')]),
        names: rows.map((row) => row.querySelector('a')?.textContent),
        hrefs: rows.map((row) => row.querySelector('a')?.getAttribute('href')),
        badges: Array.from(table.querySelectorAll('[data-status]')).map((badge) => ({
          status: badge.getAttribute('data-status'),
          text: badge.textContent,
          color: css(badge).color,
          background: css(badge).backgroundColor,
        })),
        required: rows.map((row) => row.querySelectorAll('td')[3]?.textContent),
        text: document.body.innerText,
        tableDisplay: css(table).display,
        firstCellWeight: css(rows[0].querySelector('td')!).fontWeight,
        headerHidden: (() => {
          const rect = table.querySelector('thead')!.getBoundingClientRect()
          return rect.width <= 1 && rect.height <= 1
        })(),
        group: {
          width: group.getBoundingClientRect().width,
          height: group.getBoundingClientRect().height,
          fits: group.scrollWidth <= group.clientWidth,
          tops: buttons.map((button) => Math.round(button.getBoundingClientRect().top)),
          widths: buttons.map((button) => button.getBoundingClientRect().width),
          styles: buttons.map((button) => ({
            pressed: button.getAttribute('aria-pressed'),
            color: css(button).color,
            background: css(button).backgroundColor,
          })),
        },
      }
    })

    expect(facts.headings).toEqual(['프로젝트'])
    expect(facts.names).toEqual(SEEDED)
    expect(facts.hrefs.every((href) => /^\/projects\/\d+$/.test(href ?? ''))).toBe(true)
    expect(facts.headers).toEqual([
      ['프로젝트명', 'col'],
      ['상태', 'col'],
      ['기간', 'col'],
      ['필요 인원', 'col'],
      ['배치 인원', 'col'],
      ['인력 부족', 'col'],
    ])
    expect(facts.required).toEqual(['2', '2', '2', '2', '2'])
    // T#32 (PM exception to T#15): the column header "인력 부족" is on the screen now; the seed has no project short of people, so no badge.
    await expect(page.locator('[data-status="UNDERSTAFFED"]')).toHaveCount(0)
    // T#16 (PM exception to T#15): project.manager sees "프로젝트 등록" at 1280px; at 360px it is display: none, so
    // the page text (innerText) does not have it.
    if (width === 1280) {
      expect(facts.text).toContain('프로젝트 등록')
    } else {
      expect(facts.text).not.toContain('프로젝트 등록')
    }

    // Status badges: the text and the BRIEF colours (D13).
    expect(facts.badges.map((badge) => badge.text)).toEqual(['진행 중', '완료', '진행 중', '계획', '보류'])
    for (const badge of facts.badges) {
      expect({ color: badge.color, background: badge.background }, `${badge.text} colours`).toEqual(
        BADGE_COLORS[badge.status ?? ''],
      )
    }

    // Filter control: five buttons on one line, no overflow, 40px high, the chosen one in the primary colour.
    expect(new Set(facts.group.tops).size, 'filter buttons share one line').toBe(1)
    expect(facts.group.fits).toBe(true)
    expect(facts.group.height).toBe(40)
    expect(facts.group.styles[0]).toEqual({ pressed: 'true', color: 'rgb(255, 255, 255)', background: 'rgb(41, 82, 204)' })
    for (const other of facts.group.styles.slice(1)) {
      expect(other).toEqual({ pressed: 'false', color: 'rgb(26, 31, 39)', background: 'rgb(255, 255, 255)' })
    }
    if (width === 1280) {
      expect(facts.group.width).toBeLessThanOrEqual(481)
      expect(facts.tableDisplay).toBe('table')
      expect(facts.firstCellWeight).toBe('400')
    } else {
      for (const buttonWidth of facts.group.widths) {
        expect(buttonWidth).toBeGreaterThanOrEqual(64)
      }
      expect(facts.tableDisplay).toBe('block')
      expect(facts.headerHidden).toBe(true)
      expect(facts.firstCellWeight).toBe('600')
    }

    if (width === 1280) {
      // Numeric columns end at the same x (BRIEF Checks 7).
      const edges = await page.locator('table').evaluate((table) => {
        const columns: Record<number, number[]> = {}
        for (const cell of Array.from(table.querySelectorAll('td[data-align="end"]'))) {
          const range = document.createRange()
          range.selectNodeContents(cell)
          const index = (cell as HTMLTableCellElement).cellIndex
          columns[index] = [...(columns[index] ?? []), Math.round(range.getBoundingClientRect().right)]
        }
        return Object.values(columns)
      })
      expect(edges).toHaveLength(2)
      for (const column of edges) {
        expect(new Set(column).size, `right edges ${column.join(', ')}`).toBe(1)
      }
    }

    // The filter works against the real API, the address follows it, and a reload keeps it.
    await filter(page).getByRole('button', { name: '진행 중' }).click()
    await expect(page.locator('tbody tr')).toHaveCount(2)
    await expect(page.getByRole('link', { name: '감마 프로젝트' })).toHaveCount(0)
    await expect(page.getByRole('link', { name: '알파 프로젝트' })).toBeVisible()
    await expect(page.getByRole('link', { name: '베타 프로젝트' })).toBeVisible()
    expect(new URL(page.url()).search).toBe('?status=IN_PROGRESS')
    await page.reload()
    await expect(page.locator('tbody tr')).toHaveCount(2)
    await expect(page.getByRole('link', { name: '알파 프로젝트' })).toBeVisible()
    await expect(filter(page).getByRole('button', { name: '진행 중' })).toHaveAttribute('aria-pressed', 'true')
    await filter(page).getByRole('button', { name: '전체' }).click()
    await expect(page.locator('tbody tr')).toHaveCount(5)
    expect(new URL(page.url()).search).toBe('')
  })
}

for (const width of [1280, 360]) {
  test(`values from a fixed answer at ${width}px`, async ({ page }) => {
    await loginAs(page, PROJECT_MANAGER)
    await stubProjects(page, (route) => json(route, SAMPLE))
    await open(page, width)

    expect(await filter(page).count(), 'status filters').toBe(1)
    await expect(page.locator('table')).toHaveCount(1)
    const row = page.locator('tbody tr').first()
    const link = row.getByRole('link', { name: LONG_NAME })
    await expect(link).toHaveAttribute('href', '/projects/7')
    const facts = await row.evaluate((element, longName) => {
      const cells = Array.from(element.querySelectorAll('td'))
      const nameCell = cells[0]
      const periodCell = cells[2]
      return {
        name: nameCell.textContent === longName,
        nameFits: nameCell.scrollWidth <= nameCell.clientWidth,
        period: periodCell.textContent?.replace(/\s/g, ' '),
        required: cells[3].textContent,
        assigned: cells[4].textContent,
      }
    }, LONG_NAME)
    const lines = await periodLines(page)

    expect(facts.name).toBe(true)
    expect(facts.nameFits, '48-character name wraps inside its cell').toBe(true)
    expect(facts.period).toBe('2026-05-16 ~ 2026-09-13')
    expect(facts.required).toBe('5')
    expect(facts.assigned).toBe('3')
    // The first date and the "~" always share a line (the space before "~" does not break, BRIEF §5).
    expect(lines.tilde).toBe(lines.first)
    if (width === 360) {
      // Cards (<1024px): the end date is on the next line, so the first line ends with "~" (T#15 criterion 8).
      expect(lines.second, 'the end date starts on the next line at 360px').toBeGreaterThan(lines.tilde)
    } else {
      // Table (>=1024px): one line.
      expect(lines.second, 'one line in the table').toBe(lines.tilde)
    }
  })
}

test('a date is never split, even in a very narrow card', async ({ page }) => {
  await loginAs(page, PROJECT_MANAGER)
  await stubProjects(page, (route) => json(route, SAMPLE))
  await open(page, 240)

  expect(await filter(page).count(), 'status filters').toBe(1)
  await expect(page.locator('table')).toHaveCount(1)
  const lines = await periodLines(page)
  expect(lines.dateRects, 'each date is one box on one line').toEqual([1, 1])
  expect(lines.tilde).toBe(lines.first)
  expect(lines.second).toBeGreaterThan(lines.tilde)
})

for (const width of [1280, 360]) {
  test(`states and delayed answers at ${width}px`, async ({ page }) => {
    await loginAs(page, PROJECT_MANAGER)
    const requests = await stubProjects(page, (route, search) => json(route, search ? [] : []))
    await open(page, width)

    // Empty (전체 and no projects).
    expect(await filter(page).count(), 'status filters').toBe(1)
    await expect(page.locator('[role="status"]')).toHaveCount(1)
    await expect(page.getByText('등록된 프로젝트가 없습니다')).toBeVisible()
    expect(await page.getByRole('button', { name: '필터 초기화' }).count()).toBe(0)

    // No results: a status filter with an empty answer, and 필터 초기화 asks for 전체 again.
    await filter(page).getByRole('button', { name: '계획' }).click()
    await expect(page.getByText('이 상태의 프로젝트가 없습니다')).toBeVisible()
    await page.getByRole('button', { name: '필터 초기화' }).click()
    await expect(page.getByText('등록된 프로젝트가 없습니다')).toBeVisible()
    await expect(filter(page).getByRole('button', { name: '전체' })).toHaveAttribute('aria-pressed', 'true')
    expect(requests).toEqual(['/api/projects', '/api/projects?status=PLANNED', '/api/projects'])
  })

  test(`error and retry at ${width}px`, async ({ page }) => {
    await loginAs(page, PROJECT_MANAGER)
    let failing = true
    const requests = await stubProjects(page, (route) =>
      failing ? json(route, { code: 'X', message: 'x' }, 500) : json(route, SAMPLE),
    )
    await open(page, width, '/projects?status=IN_PROGRESS')

    expect(await filter(page).count(), 'status filters').toBe(1)
    await expect(page.getByRole('alert')).toBeVisible()
    await expect(page.getByText('데이터를 불러오지 못했습니다')).toBeVisible()
    failing = false
    await page.getByRole('button', { name: '다시 시도' }).click()
    await expect(page.getByRole('link', { name: LONG_NAME })).toBeVisible()
    expect(requests).toEqual(['/api/projects?status=IN_PROGRESS', '/api/projects?status=IN_PROGRESS'])
  })
}

test('an older answer that arrives late does not replace the answer to the last filter', async ({ page }) => {
  await loginAs(page, PROJECT_MANAGER)
  let release: () => void = () => undefined
  const held = new Promise<void>((resolve) => {
    release = resolve
  })
  let heldReached = false
  let heldHandled = false
  const requests = await stubProjects(page, async (route, search) => {
    if (search === '?status=IN_PROGRESS') {
      heldReached = true
      await held
      heldHandled = true
      // The page may have cancelled this request already; a late answer to it must not matter either way.
      await json(route, [SAMPLE[0]]).catch(() => undefined)
      return
    }
    await json(route, search === '?status=DONE' ? [SAMPLE[1]] : [])
  })
  await open(page, 1280)

  expect(await filter(page).count(), 'status filters').toBe(1)
  await filter(page).getByRole('button', { name: '진행 중' }).click()
  await expect.poll(() => heldReached).toBe(true)
  expect(heldHandled, 'the first request is still held').toBe(false)
  await filter(page).getByRole('button', { name: '완료' }).click()
  await expect(page.getByRole('link', { name: '감마 프로젝트' })).toBeVisible()

  release()
  await expect.poll(() => heldHandled).toBe(true)
  await page.waitForTimeout(300)
  await expect(page.getByRole('link', { name: LONG_NAME })).toHaveCount(0)
  await expect(page.getByRole('link', { name: '감마 프로젝트' })).toBeVisible()
  await expect(filter(page).getByRole('button', { name: '완료' })).toHaveAttribute('aria-pressed', 'true')
  expect(requests).toEqual(['/api/projects', '/api/projects?status=IN_PROGRESS', '/api/projects?status=DONE'])
})

test('no sideways scroll for the list and the three states at 1280, 1024, 1023 and 360px', async ({ page }) => {
  await loginAs(page, PROJECT_MANAGER)
  let mode: 'list' | 'empty' | 'error' = 'list'
  await stubProjects(page, (route) => {
    if (mode === 'error') return json(route, { code: 'X', message: 'x' }, 500)
    return json(route, mode === 'empty' ? [] : SAMPLE)
  })
  const widths = [1280, 1024, 1023, 360]

  await open(page, 1280)
  expect(await filter(page).count(), 'status filters').toBe(1)
  await expect(page.locator('table')).toHaveCount(1)
  await expectNoHorizontalOverflow(page, widths)
  // The table is a table from 1024px up and cards below it.
  for (const [width, display] of [
    [1024, 'table'],
    [1023, 'block'],
  ] as const) {
    await page.setViewportSize({ width, height: 800 })
    await settle(page)
    expect(await page.locator('table').evaluate((table) => getComputedStyle(table).display), `${width}px`).toBe(display)
    const lines = await periodLines(page)
    // The first date and the "~" share a line in both layouts; a card puts the end date on the next line.
    expect(lines.tilde, `${width}px: "~" stays with the first date`).toBe(lines.first)
    if (display === 'block') {
      expect(lines.second, `${width}px: the end date is on the next line in a card`).toBeGreaterThan(lines.tilde)
    }
  }

  for (const next of ['empty', 'error'] as const) {
    mode = next
    await page.reload()
    await expect(page.locator(next === 'empty' ? '[role="status"]' : '[role="alert"]')).toBeVisible()
    await expectNoHorizontalOverflow(page, widths)
  }
  mode = 'empty'
  await page.reload()
  await page.getByRole('button', { name: '계획' }).click()
  await expect(page.getByText('이 상태의 프로젝트가 없습니다')).toBeVisible()
  await expectNoHorizontalOverflow(page, widths)
})
