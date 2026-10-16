import { expect, test, type Page } from '@playwright/test'
import { fileURLToPath } from 'node:url'
import { PROJECT_MANAGER } from '../support/auth'
import { expectHeading, openAssignFromList } from '../support/assign'
import { settle } from '../support/layout'

// T#53 screens (contract "화면"): the assignment screen of the seeded 알파 프로젝트 with a period of more than 366 days,
// at 1280px and 360px. The real server answers; nothing is intercepted.
const outDir = fileURLToPath(new URL('../../../docs/screens/T53/', import.meta.url))

async function shoot(page: Page, name: string): Promise<void> {
  await page.mouse.move(0, 0)
  await settle(page)
  await page.screenshot({ path: `${outDir}${name}.png`, fullPage: true, animations: 'disabled' })
}

for (const width of [1280, 360]) {
  test(`period-too-long-${width}`, async ({ page }) => {
    await openAssignFromList(page, PROJECT_MANAGER, width)
    await expectHeading(page, '알파 프로젝트')
    await page.getByLabel('종료일').fill('2027-12-31')
    await expect(page.getByLabel('종료일')).toHaveAttribute('aria-invalid', 'true')
    await shoot(page, `period-too-long-${width}`)
  })
}
