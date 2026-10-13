import { expect, test, type Page } from '@playwright/test'
import { fileURLToPath } from 'node:url'
import { EMPLOYEE_ONLY, HR_MANAGER, loginAs } from '../support/auth'
import { settle } from '../support/layout'

// T#6 screens (contract "화면"), full page.
const outDir = fileURLToPath(new URL('../../../docs/screens/T6/', import.meta.url))

async function shoot(page: Page, name: string): Promise<void> {
  // Move the pointer off the page so no button is drawn in its hover colour.
  await page.mouse.move(0, 0)
  await settle(page)
  await page.screenshot({ path: `${outDir}${name}.png`, fullPage: true, animations: 'disabled' })
}

test('login-1280', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/login')
  await expect(page.getByLabel('계정', { exact: true })).toBeVisible()
  expect(await page.locator('nav').count()).toBe(0)
  await shoot(page, 'login-1280')
})

test('login-error-360', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 })
  await page.goto('/login')
  await page.getByLabel('계정', { exact: true }).fill(HR_MANAGER.username)
  await page.getByLabel('비밀번호', { exact: true }).fill('wrong-password')
  await page.getByRole('button', { name: '로그인', exact: true }).click()
  await expect(page.getByText('계정 또는 비밀번호가 올바르지 않습니다.')).toBeVisible()
  await shoot(page, 'login-error-360')
})

test('home-1280', async ({ page }) => {
  await loginAs(page, HR_MANAGER)
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/')
  await expect(page.getByText('백엔드 상태: UP')).toBeVisible()
  await expect(page.locator('header').getByText(HR_MANAGER.name, { exact: true })).toBeVisible()
  await shoot(page, 'home-1280')
})

test('me-360', async ({ page }) => {
  await loginAs(page, EMPLOYEE_ONLY)
  await page.setViewportSize({ width: 360, height: 800 })
  await page.goto('/me')
  await expect(page.getByRole('heading', { name: '내 정보' })).toBeVisible()
  expect(await page.locator('nav a').allTextContents()).toEqual(['내 정보'])
  await shoot(page, 'me-360')
})
