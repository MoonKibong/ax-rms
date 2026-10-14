import { expect, test, type Page } from '@playwright/test'
import { fileURLToPath } from 'node:url'
import { EMPLOYEE_ONLY, HR_MANAGER, loginAs } from '../support/auth'
import { settle } from '../support/layout'
import { json } from '../support/projects'

// T#38 screens (contract criterion 11): the detail of 박소영 and 최동훈 and 내 정보 with the real seed, the list with
// its detail links, and the detail's error state from a fixed answer, at 1280px and 360px.
const outDir = fileURLToPath(new URL('../../../docs/screens/T38/', import.meta.url))
const FIXED_ID = 9001

async function open(page: Page, width: number, path: string): Promise<void> {
  await page.setViewportSize({ width, height: 800 })
  await page.goto(path)
  // The app first asks who is logged in (GET /api/auth/me); the shell, with its navigation, comes after that.
  await page.getByRole('navigation').first().waitFor()
  await page.waitForLoadState('networkidle')
}

async function shoot(page: Page, name: string): Promise<void> {
  // Move the pointer off the page so nothing is drawn in its hover colour.
  await page.mouse.move(0, 0)
  await settle(page)
  await page.screenshot({ path: `${outDir}${name}.png`, fullPage: true, animations: 'disabled' })
}

async function idOf(page: Page, name: string): Promise<number> {
  const response = await page.request.get('/api/employees')
  expect(response.status(), 'GET /api/employees').toBe(200)
  const list = (await response.json()) as Array<{ id: number; name: string }>
  return list.find((employee) => employee.name === name)!.id
}

async function openDetail(page: Page, width: number, name: string): Promise<void> {
  await loginAs(page, HR_MANAGER)
  await open(page, width, `/employees/${await idOf(page, name)}`)
  expect(await page.getByRole('heading', { level: 1, name }).count(), `${name} heading`).toBe(1)
}

for (const width of [1280, 360]) {
  test(`detail-${width}`, async ({ page }) => {
    await openDetail(page, width, '박소영')
    await expect(page.getByTestId('gantt-bar').first()).toBeVisible()
    await shoot(page, `detail-${width}`)
  })

  test(`me-${width}`, async ({ page }) => {
    await loginAs(page, EMPLOYEE_ONLY)
    await open(page, width, '/me')
    expect(await page.getByRole('heading', { level: 2, name: '한지우' }).count(), 'own name').toBe(1)
    await expect(page.getByText('배치된 프로젝트가 없습니다', { exact: true })).toBeVisible()
    await shoot(page, `me-${width}`)
  })

  test(`detail-error-${width}`, async ({ page }) => {
    await loginAs(page, HR_MANAGER)
    await page.route(
      (url) => url.pathname === `/api/employees/${FIXED_ID}`,
      (route) => json(route, { code: 'X', message: '서버 오류' }, 500),
    )
    await open(page, width, `/employees/${FIXED_ID}`)
    expect(new URL(page.url()).pathname, 'address').toBe(`/employees/${FIXED_ID}`)
    expect(await page.getByRole('alert').filter({ hasText: '서버 오류' }).count(), 'error state with the API message').toBe(1)
    await expect(page.getByRole('button', { name: '다시 시도' })).toBeVisible()
    await shoot(page, `detail-error-${width}`)
  })
}

test('detail-review-1280', async ({ page }) => {
  await openDetail(page, 1280, '최동훈')
  await expect(page.locator('main .badge[data-status="NEEDS_REVIEW"]')).toBeVisible()
  await shoot(page, 'detail-review-1280')
})

test('list-1280', async ({ page }) => {
  await loginAs(page, HR_MANAGER)
  await open(page, 1280, '/employees')
  expect(await page.locator('tbody a').count(), 'detail links').toBe(20)
  await shoot(page, 'list-1280')
})
