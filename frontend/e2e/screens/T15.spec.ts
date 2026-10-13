import { expect, test, type Page } from '@playwright/test'
import { fileURLToPath } from 'node:url'
import { PROJECT_MANAGER, loginAs } from '../support/auth'
import { settle } from '../support/layout'
import { SAMPLE, json, stubProjects } from '../support/projects'

// T#15 screens (contract "화면"): the list with the seed, and the three states from fixed answers, at 1280px and 360px.
const outDir = fileURLToPath(new URL('../../../docs/screens/T15/', import.meta.url))

// The status filter is on the screen at once, also while loading; the table or state follows the answer.
async function expectFilter(page: Page): Promise<void> {
  // The app first asks who is logged in (GET /api/auth/me); the shell, with its navigation, comes after that.
  await page.getByRole('navigation').first().waitFor()
  expect(await page.getByRole('group', { name: '상태 필터' }).count(), 'status filters').toBe(1)
}

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
    await expectFilter(page)
    await expect(page.locator('table')).toHaveCount(1)
    await expect(page.getByRole('link', { name: '알파 프로젝트' })).toBeVisible()
    expect(await page.locator('tbody tr').count()).toBe(5)
    await shoot(page, `list-${width}`)
  })

  test(`empty-${width}`, async ({ page }) => {
    await loginAs(page, PROJECT_MANAGER)
    await stubProjects(page, (route) => json(route, []))
    await page.setViewportSize({ width, height: 800 })
    await page.goto('/projects')
    await expectFilter(page)
    await expect(page.getByText('등록된 프로젝트가 없습니다')).toBeVisible()
    await shoot(page, `empty-${width}`)
  })

  test(`no-results-${width}`, async ({ page }) => {
    await loginAs(page, PROJECT_MANAGER)
    await stubProjects(page, (route, search) => json(route, search ? [] : SAMPLE))
    await page.setViewportSize({ width, height: 800 })
    await page.goto('/projects?status=PLANNED')
    await expectFilter(page)
    await expect(page.getByText('이 상태의 프로젝트가 없습니다')).toBeVisible()
    await shoot(page, `no-results-${width}`)
  })

  test(`error-${width}`, async ({ page }) => {
    await loginAs(page, PROJECT_MANAGER)
    await stubProjects(page, (route) => json(route, { code: 'X', message: 'x' }, 500))
    await page.setViewportSize({ width, height: 800 })
    await page.goto('/projects')
    await expectFilter(page)
    await expect(page.getByRole('alert')).toBeVisible()
    await shoot(page, `error-${width}`)
  })
}
