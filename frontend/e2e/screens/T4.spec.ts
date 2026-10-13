import { expect, test } from '@playwright/test'
import { fileURLToPath } from 'node:url'
import { HR_MANAGER, loginAs } from '../support/auth'
import { settle } from '../support/layout'

// T#4 screens (contract "화면"): the reference screen at 1280px and 360px, full page.
const outDir = fileURLToPath(new URL('../../../docs/screens/T4/', import.meta.url))

for (const width of [1280, 360]) {
  test(`reference-${width}`, async ({ page }) => {
    // T#6: `/` needs a login now.
    await loginAs(page, HR_MANAGER)
    await page.setViewportSize({ width, height: 800 })
    await page.goto('/')
    await settle(page)
    for (const landmark of ['header', 'nav', 'main']) {
      expect(await page.locator(landmark).count(), landmark).toBe(1)
    }
    await expect(page.getByText('백엔드 상태: UP')).toBeVisible()
    await page.screenshot({ path: `${outDir}reference-${width}.png`, fullPage: true, animations: 'disabled' })
  })
}
