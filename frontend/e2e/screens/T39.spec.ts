import { expect, test, type Page } from '@playwright/test'
import { fileURLToPath } from 'node:url'
import { HR_MANAGER, loginAs } from '../support/auth'
import { settle } from '../support/layout'
import { json } from '../support/projects'

// T#39 screens (contract criterion 13) on the shared e2e DB: the list with 직원 등록, the detail with its buttons and
// without them at 360px, the two forms, the desktop notice, and three states from fixed answers. No employee write
// leaves the browser: page.route answers every POST/PUT/PATCH /api/employees….
const outDir = fileURLToPath(new URL('../../../docs/screens/T39/', import.meta.url))

const nameInput = (page: Page) => page.getByRole('textbox', { name: '이름', exact: true })
const button = (page: Page, name: string) => page.getByRole('button', { name, exact: true })
const title = (page: Page, name: string) => page.getByRole('heading', { level: 1, name, exact: true })

test.beforeEach(async ({ page }) => {
  await page.route(
    (url) => url.pathname.startsWith('/api/employees'),
    (route) =>
      route.request().method() === 'GET'
        ? route.fallback()
        : json(route, { code: 'E2E_NO_WRITE', message: '공유 DB에는 쓰지 않습니다.' }, 400),
  )
  await loginAs(page, HR_MANAGER)
})

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

test('list-1280', async ({ page }) => {
  await open(page, 1280, '/employees')
  expect(await button(page, '직원 등록').count(), '직원 등록').toBe(1)
  await expect(title(page, '직원')).toBeVisible()
  await expect(button(page, '직원 등록')).toBeVisible()
  await expect(page.locator('tbody a').first()).toBeVisible()
  await shoot(page, 'list-1280')
})

test('detail-1280', async ({ page }) => {
  await open(page, 1280, `/employees/${await idOf(page, '박소영')}`)
  expect(await button(page, '수정').count(), '수정').toBe(1)
  await expect(title(page, '박소영')).toBeVisible()
  await expect(button(page, '수정')).toBeVisible()
  await expect(button(page, '상태 변경')).toBeVisible()
  await expect(page.getByTestId('gantt-bar').first()).toBeVisible()
  await shoot(page, 'detail-1280')
})

test('detail-360', async ({ page }) => {
  await open(page, 360, `/employees/${await idOf(page, '박소영')}`)
  expect(await page.getByRole('heading', { level: 1, name: '박소영' }).count(), '박소영').toBe(1)
  await expect(title(page, '박소영')).toBeVisible()
  // The buttons are in the DOM but display: none below 1024px, so they are counted with the hidden ones.
  expect(await page.getByRole('button', { name: '수정', exact: true, includeHidden: true }).count(), '수정 in the DOM').toBe(1)
  await expect(button(page, '수정')).toBeHidden()
  await expect(button(page, '상태 변경')).toBeHidden()
  await shoot(page, 'detail-360')
})

test('form-new-1280', async ({ page }) => {
  await open(page, 1280, '/employees/new')
  expect(await page.getByRole('heading', { level: 1, name: '직원 등록' }).count(), '직원 등록').toBe(1)
  await expect(title(page, '직원 등록')).toBeVisible()
  await expect(nameInput(page)).toBeVisible()
  await shoot(page, 'form-new-1280')
})

test('form-edit-1280', async ({ page }) => {
  await open(page, 1280, `/employees/${await idOf(page, '박소영')}/edit`)
  expect(await page.getByRole('heading', { level: 1, name: '직원 수정' }).count(), '직원 수정').toBe(1)
  await expect(title(page, '직원 수정')).toBeVisible()
  await expect(nameInput(page)).toHaveValue('박소영')
  await shoot(page, 'form-edit-1280')
})

test('form-notice-360', async ({ page }) => {
  await open(page, 360, '/employees/new')
  expect(await page.getByText('데스크톱에서 이용해 주세요', { exact: true }).count(), 'notice').toBe(1)
  await expect(title(page, '직원 등록')).toBeVisible()
  await expect(page.getByText('데스크톱에서 이용해 주세요', { exact: true })).toBeVisible()
  await expect(nameInput(page)).toBeHidden()
  await shoot(page, 'form-notice-360')
})

test('form-error-1280', async ({ page }) => {
  await page.route(
    (url) => url.pathname === '/api/employees',
    (route) =>
      route.request().method() === 'POST'
        ? json(route, { code: 'EMPLOYEE_NAME_REQUIRED', message: '이름을 입력하세요.' }, 400)
        : route.fallback(),
  )
  await open(page, 1280, '/employees/new')
  expect(await button(page, '저장').count(), '저장').toBe(1)
  await expect(title(page, '직원 등록')).toBeVisible()
  await button(page, '저장').click()
  await expect(page.getByText('이름을 입력하세요.', { exact: true })).toBeVisible()
  await expect(nameInput(page)).toHaveAttribute('aria-invalid', 'true')
  await shoot(page, 'form-error-1280')
})

test('form-load-error-1280', async ({ page }) => {
  await page.route(
    (url) => url.pathname === '/api/departments',
    (route) => json(route, { code: 'X', message: '서버 오류' }, 500),
  )
  await open(page, 1280, '/employees/new')
  expect(await page.getByRole('heading', { level: 1, name: '직원 등록' }).count(), '직원 등록').toBe(1)
  await expect(title(page, '직원 등록')).toBeVisible()
  await expect(page.getByText('데이터를 불러오지 못했습니다', { exact: true })).toBeVisible()
  await expect(page.getByRole('alert').filter({ hasText: '서버 오류' })).toBeVisible()
  await expect(button(page, '다시 시도')).toBeVisible()
  await shoot(page, 'form-load-error-1280')
})

test('status-dialog-1280', async ({ page }) => {
  const id = await idOf(page, '박소영')
  await page.route(
    (url) => url.pathname === `/api/employees/${id}/status`,
    (route) => json(route, { code: 'EMPLOYEE_REASON_REQUIRED', message: '투입 불가 사유를 입력하세요.' }, 400),
  )
  await open(page, 1280, `/employees/${id}`)
  expect(await button(page, '상태 변경').count(), '상태 변경').toBe(1)
  await expect(title(page, '박소영')).toBeVisible()
  // The backdrop covers the viewport. Make the viewport the whole page, so the full-page PNG shows what a person sees.
  await page.setViewportSize({ width: 1280, height: await page.evaluate(() => document.documentElement.scrollHeight) })
  await button(page, '상태 변경').click()
  const dialog = page.getByRole('dialog', { name: '상태 변경' })
  await expect(dialog.getByRole('heading', { level: 2, name: '상태 변경', exact: true })).toBeVisible()
  await dialog.getByRole('combobox', { name: '상태', exact: true }).selectOption({ label: '투입 불가' })
  await dialog.getByRole('button', { name: '저장', exact: true }).click()
  await expect(dialog.getByText('투입 불가 사유를 입력하세요.', { exact: true })).toBeVisible()
  await shoot(page, 'status-dialog-1280')
})
