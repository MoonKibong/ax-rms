import { expect, test, type Page } from '@playwright/test'
import { HR_MANAGER, loginAs } from './support/auth'
import { expectNoHorizontalOverflow, settle } from './support/layout'

// T#12: the Gantt section of the reference screen (constants in App.tsx). Colours are the BRIEF §2 tokens as rgb().
const PRIMARY = 'rgb(41, 82, 204)'
const SURFACE = 'rgb(255, 255, 255)'
const SURFACE_SUBTLE = 'rgb(238, 241, 245)'
const BORDER_STRONG = 'rgb(125, 135, 150)'
const DANGER = 'rgb(191, 43, 27)'
const WARNING = 'rgb(143, 83, 0)'
const WARNING_BG = 'rgb(253, 241, 220)'

async function open(page: Page, width: number): Promise<void> {
  // T#6: `/` needs a login now; a manager account sees the reference screen.
  await loginAs(page, HR_MANAGER)
  await page.setViewportSize({ width, height: 800 })
  await page.goto('/')
  await settle(page)
}

type Rect = { left: number; right: number; top: number; bottom: number }

for (const width of [1280, 360]) {
  test(`gantt looks right at ${width}px`, async ({ page }) => {
    await open(page, width)
    const gantt = page.getByTestId('gantt')
    expect(await gantt.count(), 'gantt sections').toBe(1)

    const facts = await gantt.evaluate((root) => {
      const css = (element: Element) => getComputedStyle(element)
      const rect = (element: Element): Rect => {
        const r = element.getBoundingClientRect()
        return { left: r.left, right: r.right, top: r.top, bottom: r.bottom }
      }
      const parent = root.parentElement!
      const chart = root.querySelector('[data-testid="gantt-chart"]')!
      const bars = Array.from(root.querySelectorAll('[data-testid="gantt-bar"]')).map((bar) => ({
        status: bar.getAttribute('data-status'),
        text: bar.textContent,
        background: css(bar).backgroundColor,
        borderWidth: css(bar).borderTopWidth,
        borderColor: css(bar).borderTopColor,
        rect: rect(bar),
        label: (() => {
          const label = bar.closest('.gantt__track')!.querySelector('[data-gantt-text]')
          return label ? rect(label) : null
        })(),
      }))
      const bands = Array.from(root.querySelectorAll('[data-testid="gantt-overlap"]')).map((band) => ({
        background: css(band).backgroundColor,
        borderWidth: css(band).borderTopWidth,
        borderColor: css(band).borderTopColor,
        width: band.getBoundingClientRect().width,
      }))
      const totalColors = Array.from(root.querySelectorAll('[data-gantt-overlap-text]')).map((el) => css(el).color)
      const todayLines = Array.from(root.querySelectorAll('[data-testid="gantt-today-line"]')).map((line) => ({
        width: line.getBoundingClientRect().width,
        background: css(line).backgroundColor,
      }))
      const texts = Array.from(root.querySelectorAll('[data-gantt-text]')).map((text) => ({
        name: text.textContent,
        rect: rect(text),
        track: rect(text.closest('.gantt__track')!),
        ellipsis: css(text).textOverflow === 'ellipsis',
      }))
      const ticks = Array.from(root.querySelectorAll('[data-gantt-tick]')).map((tick) => ({
        name: tick.textContent,
        fraction: Number(tick.getAttribute('data-gantt-tick')),
        trackWidth: tick.closest('.gantt__track')!.getBoundingClientRect().width,
      }))
      const heads = Array.from(root.querySelectorAll('[data-testid="gantt-head"]')).map((head) => ({
        name: head.textContent,
        fits: head.scrollWidth <= head.clientWidth,
        rect: rect(head),
        track: rect(head.closest('.gantt__row')!.querySelector('.gantt__track')!),
      }))
      return {
        width: root.getBoundingClientRect().width,
        parentWidth: parent.getBoundingClientRect().width,
        chartBackground: css(chart).backgroundColor,
        bars,
        bands,
        totalColors,
        todayLines,
        texts,
        ticks,
        heads,
      }
    })

    // The chart is as wide as its parent and sits on the surface colour.
    expect(Math.abs(facts.width - facts.parentWidth)).toBeLessThanOrEqual(1)
    expect(facts.chartBackground).toBe(SURFACE)

    // Bars: colour by project status, and no text inside (BRIEF §7 item 13).
    expect(facts.bars.length).toBe(4)
    for (const bar of facts.bars) {
      expect(bar.text, 'text inside a bar').toBe('')
      if (bar.status === 'active') {
        expect(bar.background).toBe(PRIMARY)
      } else {
        expect(bar.background).toBe(SURFACE_SUBTLE)
        expect([bar.borderWidth, bar.borderColor]).toEqual(['1px', BORDER_STRONG])
      }
    }
    expect(facts.bars.some((bar) => bar.status === 'other')).toBe(true)

    // Each label sits right under its own bar (at most 8px below).
    for (const bar of facts.bars) {
      expect(bar.label, 'label under bar').not.toBeNull()
      const gap = bar.label!.top - bar.rect.bottom
      expect(gap).toBeGreaterThanOrEqual(0)
      expect(gap).toBeLessThanOrEqual(8)
    }

    // Overlap bands: at least 2px wide, warning colours; totals in the warning colour.
    expect(facts.bands.length).toBe(4)
    for (const band of facts.bands) {
      expect(band.width).toBeGreaterThanOrEqual(2)
      expect([band.background, band.borderWidth, band.borderColor]).toEqual([WARNING_BG, '1px', WARNING])
    }
    expect(facts.totalColors.length).toBe(4)
    for (const color of facts.totalColors) {
      expect(color).toBe(WARNING)
    }

    // Today line: 1px, danger colour.
    expect(facts.todayLines.length).toBeGreaterThan(0)
    for (const line of facts.todayLines) {
      expect(line.width).toBeCloseTo(1, 1)
      expect(line.background).toBe(DANGER)
    }

    // Every visible text is inside its track, none overlaps another, none is cut with an ellipsis (BRIEF §7 item 13).
    expect(facts.texts.length).toBeGreaterThan(8)
    for (const text of facts.texts) {
      expect(text.rect.left, `${text.name}: left edge`).toBeGreaterThanOrEqual(text.track.left - 1)
      expect(text.rect.right, `${text.name}: right edge`).toBeLessThanOrEqual(text.track.right + 1)
      expect(text.ellipsis, `${text.name}: ellipsis`).toBe(false)
    }
    for (let i = 0; i < facts.texts.length; i += 1) {
      for (let j = i + 1; j < facts.texts.length; j += 1) {
        const a = facts.texts[i].rect
        const b = facts.texts[j].rect
        const overlaps = a.left < b.right - 0.5 && b.left < a.right - 0.5 && a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5
        expect(overlaps, `"${facts.texts[i].name}" overlaps "${facts.texts[j].name}"`).toBe(false)
      }
    }

    // Month marks that have a label are at least 40px apart on the track.
    expect(facts.ticks.length).toBeGreaterThan(1)
    const positions = facts.ticks.map((tick) => tick.fraction * tick.trackWidth).sort((a, b) => a - b)
    for (let i = 1; i < positions.length; i += 1) {
      expect(positions[i] - positions[i - 1]).toBeGreaterThanOrEqual(39.5)
    }

    // The 48-character project name wraps inside its head cell.
    const longHead = facts.heads.find((head) => (head.name ?? '').length === 48)
    expect(longHead, '48-character project name').toBeDefined()
    expect(longHead!.fits).toBe(true)

    // Head and track: side by side at 1280px (head 160px wide), stacked at 360px.
    for (const head of facts.heads) {
      if (width === 1280) {
        expect(head.rect.right - head.rect.left).toBe(160)
        expect(head.rect.right).toBeLessThanOrEqual(head.track.left + 0.5)
        expect(head.rect.top).toBeLessThan(head.track.bottom)
      } else {
        expect(head.rect.bottom).toBeLessThanOrEqual(head.track.top + 0.5)
        expect(Math.abs(head.rect.left - head.track.left)).toBeLessThan(1)
      }
    }
  })
}

test('gantt does not scroll sideways at 1280, 1024, 1023 and 360px', async ({ page }) => {
  await open(page, 1280)
  expect(await page.getByTestId('gantt').count(), 'gantt sections').toBe(1)
  await expectNoHorizontalOverflow(page, [1280, 1024, 1023, 360])
})
