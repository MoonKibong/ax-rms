import { expect, test, type Page } from '@playwright/test'
import { fileURLToPath } from 'node:url'
import { PROJECT_MANAGER, loginAs } from '../support/auth'
import { EMPTY, LIST_TITLES, WITH_ITEMS, expectDashboard, json, openAt, region, stubDashboard } from '../support/dashboard'
import { settle } from '../support/layout'

// T#18 screens (contract "화면"): the dashboard with the seed, and with fixed answers (every list filled, every list
// empty, the error), at 1280px and 360px, full page.
const outDir = fileURLToPath(new URL('../../../docs/screens/T18/', import.meta.url))

async function shoot(page: Page, name: string): Promise<void> {
  await page.mouse.move(0, 0)
  await settle(page)
  await page.screenshot({ path: `${outDir}${name}.png`, fullPage: true, animations: 'disabled' })
}

async function expectAnswered(page: Page): Promise<void> {
  await expectDashboard(page)
  await expect(region(page, '요약').getByRole('link')).toHaveCount(5)
  for (const title of LIST_TITLES) {
    await expect(page.getByRole('heading', { level: 2, name: title })).toBeVisible()
  }
}

for (const width of [1280, 360]) {
  test(`dashboard-${width}`, async ({ page }) => {
    await loginAs(page, PROJECT_MANAGER)
    await openAt(page, width)
    await expectAnswered(page)
    await expect(region(page, '직원별 가용률').getByRole('listitem').first()).toBeVisible()
    await shoot(page, `dashboard-${width}`)
  })

  test(`items-${width}`, async ({ page }) => {
    await loginAs(page, PROJECT_MANAGER)
    await stubDashboard(page, (route) => json(route, WITH_ITEMS))
    await openAt(page, width)
    await expectAnswered(page)
    await expect(page.getByText('부족한 역량: Java 2명')).toBeVisible()
    await expect(page.getByText('72.0%')).toBeVisible()
    await shoot(page, `items-${width}`)
  })

  test(`empty-${width}`, async ({ page }) => {
    await loginAs(page, PROJECT_MANAGER)
    await stubDashboard(page, (route) => json(route, EMPTY))
    await openAt(page, width)
    await expectAnswered(page)
    await expect(page.getByText('확인이 필요한 배치가 없습니다')).toBeVisible()
    await expect(page.getByText('인력이 부족한 프로젝트가 없습니다')).toBeVisible()
    await shoot(page, `empty-${width}`)
  })

  test(`error-${width}`, async ({ page }) => {
    await loginAs(page, PROJECT_MANAGER)
    await stubDashboard(page, (route) => json(route, { code: 'X', message: 'x' }, 500))
    await openAt(page, width)
    await expectDashboard(page)
    await expect(page.getByRole('alert')).toHaveCount(4)
    await expect(page.getByRole('alert').first()).toBeVisible()
    await shoot(page, `error-${width}`)
  })
}
