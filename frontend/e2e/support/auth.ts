import { expect, type Page } from '@playwright/test'

// Demo accounts (T#5 seed; T#6 contract "데모 계정"). README lists the same values.
export type DemoAccount = { username: string; password: string; name: string; home: string }

export const HR_MANAGER: DemoAccount = { username: 'hr.manager', password: 'HrManager!1', name: '이수민', home: '/' }
export const PROJECT_MANAGER: DemoAccount = {
  username: 'project.manager',
  password: 'ProjectManager!1',
  name: '정하늘',
  home: '/',
}
export const EMPLOYEE_ONLY: DemoAccount = { username: 'employee.demo', password: 'Employee!1', name: '한지우', home: '/me' }
export const DUAL_MANAGER: DemoAccount = { username: 'dual.manager', password: 'DualManager!1', name: '오승현', home: '/' }

export const MANAGERS = [HR_MANAGER, PROJECT_MANAGER, DUAL_MANAGER]

// Logs in through the login API in the page's own browser context, so the page carries the session cookie.
// Screen tasks that open a protected screen call this before page.goto.
export async function loginAs(page: Page, account: DemoAccount): Promise<void> {
  const response = await page.request.post('/api/auth/login', {
    data: { username: account.username, password: account.password },
  })
  expect(response.status(), `${account.username} 로그인`).toBe(200)
}
