import { expect, test, type Page } from '@playwright/test'
import { PROJECT_MANAGER, loginAs } from './support/auth'
import { settle } from './support/layout'

// T#55 criterion 12 against the real backend (scripts/e2e-servers.sh): the session cookie goes away while the app is open,
// and a link to a screen that was never opened logged out. Reads only; nothing is saved.
const pathOf = (page: Page) => new URL(page.url()).pathname + new URL(page.url()).search

async function logInThroughTheForm(page: Page): Promise<void> {
  await page.getByLabel('계정', { exact: true }).fill(PROJECT_MANAGER.username)
  await page.getByLabel('비밀번호', { exact: true }).fill(PROJECT_MANAGER.password)
  await page.getByRole('button', { name: '로그인', exact: true }).click()
  await page.locator('nav').waitFor() // the menu is drawn only for a logged-in user
}

test('a session that ended while the app was open: the next screen goes to /login and logging in comes back to it', async ({ page }) => {
  await loginAs(page, PROJECT_MANAGER)
  await page.goto('/')
  await page.waitForLoadState('networkidle')
  await settle(page)
  expect(pathOf(page)).toBe('/')

  await page.context().clearCookies()
  const answered = page.waitForResponse((response) => new URL(response.url()).pathname === '/api/employees')
  await page.locator('nav').getByRole('link', { name: '직원', exact: true }).click()
  expect((await answered).status()).toBe(401)
  await page.waitForLoadState('networkidle')
  await settle(page)
  expect(pathOf(page)).toBe('/login')
  expect(await page.getByLabel('계정', { exact: true }).count()).toBe(1)
  expect(await page.getByRole('button', { name: '다시 시도' }).count()).toBe(0)

  await logInThroughTheForm(page)
  await page.waitForLoadState('networkidle')
  await settle(page)
  expect(pathOf(page)).toBe('/employees')
})

test('a logged-out visitor who opens a project address is sent back to it after logging in', async ({ page }) => {
  await page.goto('/projects/1')
  await page.waitForLoadState('networkidle')
  await settle(page)
  expect(pathOf(page)).toBe('/login')

  await logInThroughTheForm(page)
  await page.waitForLoadState('networkidle')
  await settle(page)
  expect(pathOf(page)).toBe('/projects/1')
})
