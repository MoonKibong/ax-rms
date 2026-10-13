import { expect, test, type Page } from '@playwright/test'
import { expectNoHorizontalOverflow, settle } from './support/layout'

// The 48-character value without spaces or hyphens on the reference screen (BRIEF §6.0).
const LONG_VALUE = 'workforceplannerreferenceunbrokenvaluesample0048'

async function open(page: Page, width: number): Promise<void> {
  await page.setViewportSize({ width, height: 800 })
  await page.goto('/')
  await settle(page)
}

async function box(page: Page, selector: string) {
  const rect = await page.locator(selector).first().boundingBox()
  expect(rect, selector).not.toBeNull()
  return rect!
}

for (const width of [1280, 1024, 1023, 360]) {
  test(`reference screen fits ${width}px`, async ({ page }) => {
    await open(page, width)
    expect(await page.locator('nav').count()).toBe(1)

    await expectNoHorizontalOverflow(page, [width])

    const header = await box(page, 'header')
    const nav = await box(page, 'nav')
    const linkTops = await page
      .locator('nav a')
      .evaluateAll((links) => links.map((link) => Math.round(link.getBoundingClientRect().top)))
    expect(linkTops).toHaveLength(3)
    expect(nav.x).toBe(0)
    expect(nav.y).toBeGreaterThanOrEqual(header.y + header.height - 0.5)
    if (width >= 1024) {
      // Wide: vertical sidebar, 220px.
      expect(nav.width).toBe(220)
      expect(linkTops[1]).toBeGreaterThan(linkTops[0])
      expect(linkTops[2]).toBeGreaterThan(linkTops[1])
    } else {
      // Narrow: horizontal tab bar under the header, 44px high, full width.
      const clientWidth = await page.evaluate(() => document.documentElement.clientWidth)
      expect(nav.width).toBe(clientWidth)
      expect(nav.height).toBe(44)
      expect(new Set(linkTops).size).toBe(1)
    }

    // First column: card title weight 600 below 1024px, body weight 400 in the wide table (BRIEF §3.3).
    const firstCellWeight = await page
      .locator('tbody td:first-child')
      .first()
      .evaluate((cell) => getComputedStyle(cell).fontWeight)
    expect(firstCellWeight, 'first column font-weight').toBe(width >= 1024 ? '400' : '600')

    const longCell = page.locator('td', { hasText: LONG_VALUE })
    expect(await longCell.count()).toBe(1)
    const fits = await longCell.evaluate((cell) => cell.scrollWidth <= cell.clientWidth)
    expect(fits, 'long value wraps inside its cell').toBe(true)
  })
}

for (const width of [1280, 360]) {
  test(`reference screen measurements at ${width}px`, async ({ page }) => {
    await open(page, width)
    expect(await page.locator('nav').count()).toBe(1)

    // Input error message: at most 4px below the input, same left edge (BRIEF Checks 6).
    const input = page.getByLabel('투입률')
    const messageId = await input.getAttribute('aria-describedby')
    expect(messageId).toBeTruthy()
    const inputBox = (await input.boundingBox())!
    const messageBox = (await page.locator(`[id="${messageId}"]`).boundingBox())!
    const gap = messageBox.y - (inputBox.y + inputBox.height)
    expect(gap).toBeGreaterThanOrEqual(0)
    expect(gap).toBeLessThanOrEqual(4)
    expect(Math.abs(messageBox.x - inputBox.x)).toBeLessThan(0.5)

    // Loading button keeps the width of the idle button with the same label (BRIEF Checks 5).
    const idle = (await page.getByTestId('save-idle').boundingBox())!
    const loading = (await page.getByTestId('save-loading').boundingBox())!
    expect(loading.width).toBe(idle.width)

    // Keyboard focus ring on the primary button (BRIEF Checks 10).
    const primary = page.getByTestId('primary-button')
    for (let i = 0; i < 30; i += 1) {
      await page.keyboard.press('Tab')
      if (await primary.evaluate((element) => element === document.activeElement)) {
        break
      }
    }
    const focus = await primary.evaluate((element) => {
      const style = getComputedStyle(element)
      return {
        active: element === document.activeElement,
        width: style.outlineWidth,
        color: style.outlineColor,
        offset: style.outlineOffset,
      }
    })
    expect(focus).toEqual({ active: true, width: '2px', color: 'rgb(41, 82, 204)', offset: '2px' })

    if (width === 1280) {
      // Numeric columns: the text of every cell in a column ends at the same x (BRIEF Checks 7).
      const rightEdges = await page.locator('table').evaluate((table) => {
        const columns: Record<number, number[]> = {}
        for (const cell of Array.from(table.querySelectorAll('td[data-align="end"]'))) {
          const range = document.createRange()
          range.selectNodeContents(cell)
          const index = (cell as HTMLTableCellElement).cellIndex
          columns[index] = [...(columns[index] ?? []), Math.round(range.getBoundingClientRect().right)]
        }
        return Object.values(columns)
      })
      expect(rightEdges.length).toBeGreaterThan(0)
      for (const edges of rightEdges) {
        expect(new Set(edges).size, `right edges ${edges.join(', ')}`).toBe(1)
      }
    }
  })
}

test('bundled Pretendard loads and every request stays local', async ({ page }) => {
  const requests: string[] = []
  const fontResponses: Array<{ url: string; status: number }> = []
  const failedFonts: string[] = []
  page.on('request', (request) => requests.push(request.url()))
  page.on('response', (response) => {
    if (response.request().resourceType() === 'font') {
      fontResponses.push({ url: response.url(), status: response.status() })
    }
  })
  page.on('requestfailed', (request) => {
    if (request.resourceType() === 'font') {
      failedFonts.push(request.url())
    }
  })

  await open(page, 1280)

  // (b) FontFace: at least one Pretendard face is loaded. document.fonts.check() is not used (T#4 criterion 10).
  const loadedFaces = await page.evaluate(
    () =>
      Array.from(document.fonts).filter(
        (face) => face.family.replace(/["']/g, '') === 'Pretendard' && face.status === 'loaded',
      ).length,
  )
  expect(loadedFaces).toBeGreaterThan(0)

  // (a) Font files come from the local app with 200, and no font request failed.
  const local = fontResponses.filter((r) => r.url.startsWith('http://localhost:14173/') && r.status === 200)
  expect(local.length).toBeGreaterThan(0)
  expect(fontResponses.filter((r) => r.status !== 200)).toEqual([])
  expect(failedFonts).toEqual([])

  // (c) Network: every http(s) request goes to localhost.
  const external = requests.filter((url) => /^https?:/.test(url) && new URL(url).hostname !== 'localhost')
  expect(external).toEqual([])
})
