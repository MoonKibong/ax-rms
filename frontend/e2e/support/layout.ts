import { expect, type Page } from '@playwright/test'

// Waits for web fonts and every finite animation or transition, so sizes are measured after they end.
export async function settle(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await document.fonts.ready
    const finite = document
      .getAnimations()
      .filter((animation) => animation.effect?.getTiming().iterations !== Infinity)
    await Promise.all(finite.map((animation) => animation.finished.catch(() => undefined)))
  })
}

// Asserts that the current page has no horizontal overflow at each width: the document is not wider than the
// viewport and no element's right edge passes it. Screen tasks reuse this for their own screens.
export async function expectNoHorizontalOverflow(page: Page, widths: number[]): Promise<void> {
  for (const width of widths) {
    await page.setViewportSize({ width, height: 800 })
    await settle(page)
    const result = await page.evaluate(() => {
      const viewport = window.innerWidth
      const offenders = Array.from(document.querySelectorAll('body *'))
        .filter((element) => {
          const rect = element.getBoundingClientRect()
          return rect.width > 0 && rect.right > viewport + 0.5
        })
        .slice(0, 5)
        .map((element) => {
          const name = [element.tagName.toLowerCase(), ...Array.from(element.classList)].join('.')
          return `${name} right=${Math.round(element.getBoundingClientRect().right)}`
        })
      return { scrollWidth: document.documentElement.scrollWidth, viewport, offenders }
    })
    expect(result.scrollWidth, `${width}px: document scrollWidth`).toBeLessThanOrEqual(result.viewport)
    expect(result.offenders, `${width}px: elements past the right edge`).toEqual([])
  }
}
