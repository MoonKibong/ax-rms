import { expect, test } from '@playwright/test'
import { fileURLToPath } from 'node:url'
import { settle } from '../support/layout'

// T#12 screens (contract "화면"): the Gantt section of the reference screen at 1280px and 360px.
const outDir = fileURLToPath(new URL('../../../docs/screens/T12/', import.meta.url))

for (const width of [1280, 360]) {
  test(`gantt-${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 })
    await page.goto('/')
    await settle(page)
    const gantt = page.getByTestId('gantt')
    expect(await gantt.count(), 'gantt sections').toBe(1)
    await gantt.screenshot({ path: `${outDir}gantt-${width}.png`, animations: 'disabled' })
  })
}
