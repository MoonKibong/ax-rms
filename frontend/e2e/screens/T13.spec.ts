import { expect, test, type Page } from '@playwright/test'
import { fileURLToPath } from 'node:url'
import { HR_MANAGER, loginAs } from '../support/auth'
import { SAMPLE, stubEmployees } from '../support/employees'
import { settle } from '../support/layout'
import { json } from '../support/projects'

// T#13 screens (contract criterion 12): the list with the seed, the open filters at 360px, and the three states from
// fixed answers, at 1280px and 360px.
const outDir = fileURLToPath(new URL('../../../docs/screens/T13/', import.meta.url))

async function open(page: Page, width: number, path = '/employees'): Promise<void> {
  await page.setViewportSize({ width, height: 800 })
  await page.goto(path)
  // The app first asks who is logged in (GET /api/auth/me); the shell, with its navigation, comes after that.
  await page.getByRole('navigation').first().waitFor()
  await page.waitForLoadState('networkidle')
  expect(await page.getByLabel('이름 검색', { exact: true }).count(), 'name search').toBe(1)
}

async function shoot(page: Page, name: string): Promise<void> {
  // Move the pointer off the page so nothing is drawn in its hover colour.
  await page.mouse.move(0, 0)
  await settle(page)
  await page.screenshot({ path: `${outDir}${name}.png`, fullPage: true, animations: 'disabled' })
}

for (const width of [1280, 360]) {
  test(`list-${width}`, async ({ page }) => {
    await loginAs(page, HR_MANAGER)
    await open(page, width)
    expect(await page.locator('table').count(), 'employee table').toBe(1)
    await expect(page.getByRole('cell', { name: '박소영', exact: true })).toBeVisible()
    await shoot(page, `list-${width}`)
  })

  test(`empty-${width}`, async ({ page }) => {
    await loginAs(page, HR_MANAGER)
    await stubEmployees(page, (route) => json(route, []))
    await open(page, width)
    await expect(page.getByText('등록된 직원이 없습니다', { exact: true })).toBeVisible()
    await shoot(page, `empty-${width}`)
  })

  test(`no-results-${width}`, async ({ page }) => {
    await loginAs(page, HR_MANAGER)
    await stubEmployees(page, (route, search) => json(route, search ? [] : SAMPLE))
    await open(page, width, '/employees?status=UNAVAILABLE')
    await expect(page.getByText('조건에 맞는 직원이 없습니다', { exact: true })).toBeVisible()
    await shoot(page, `no-results-${width}`)
  })

  test(`error-${width}`, async ({ page }) => {
    await loginAs(page, HR_MANAGER)
    await stubEmployees(page, (route) => json(route, { code: 'X', message: 'x' }, 500))
    await open(page, width)
    await expect(page.getByRole('alert')).toBeVisible()
    await shoot(page, `error-${width}`)
  })
}

test('filters-360', async ({ page }) => {
  await loginAs(page, HR_MANAGER)
  await open(page, 360)
  expect(await page.locator('table').count(), 'employee table').toBe(1)
  await page.getByRole('button', { name: /^필터/ }).click()
  await page.getByLabel('투입 상태', { exact: true }).selectOption({ label: '투입 불가' })
  await expect.poll(() => new URL(page.url()).search).toBe('?status=UNAVAILABLE')
  await expect(page.getByRole('cell', { name: '최동훈', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: '필터 (1)' })).toHaveAttribute('aria-expanded', 'true')
  await shoot(page, 'filters-360')
})
