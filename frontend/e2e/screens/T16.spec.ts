import { expect, test, type Page } from '@playwright/test'
import { fileURLToPath } from 'node:url'
import { PROJECT_MANAGER, loginAs } from '../support/auth'
import { settle } from '../support/layout'

// T#16 screens (contract "화면"): the list with its register button, and the detail of the seeded 알파 프로젝트,
// at 1280px and 360px.
const outDir = fileURLToPath(new URL('../../../docs/screens/T16/', import.meta.url))

async function shoot(page: Page, name: string): Promise<void> {
  await page.mouse.move(0, 0)
  await settle(page)
  await page.screenshot({ path: `${outDir}${name}.png`, fullPage: true, animations: 'disabled' })
}

for (const width of [1280, 360]) {
  test(`list-${width}`, async ({ page }) => {
    await loginAs(page, PROJECT_MANAGER)
    await page.setViewportSize({ width, height: 800 })
    await page.goto('/projects')
    await page.getByRole('navigation').first().waitFor()
    expect(await page.locator('a[href="/projects/new"]').count(), 'register links').toBe(1)
    await expect(page.getByRole('link', { name: '알파 프로젝트' })).toBeVisible()
    await shoot(page, `list-${width}`)
  })

  test(`detail-${width}`, async ({ page }) => {
    await loginAs(page, PROJECT_MANAGER)
    await page.setViewportSize({ width, height: 800 })
    await page.goto('/projects')
    await page.getByRole('navigation').first().waitFor()
    await page.getByRole('link', { name: '알파 프로젝트' }).click()
    await page.getByRole('navigation').first().waitFor()
    await expect(page.getByRole('heading', { level: 1, name: '알파 프로젝트' }), 'detail headings').toHaveCount(1)
    await expect(page.getByRole('region', { name: '배치 인력' }).locator('tbody tr')).toHaveCount(3)
    await shoot(page, `detail-${width}`)
  })
}
