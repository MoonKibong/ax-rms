import { expect, type Page, type Route } from '@playwright/test'
import { loginAs, type DemoAccount } from './auth'
import { settle } from './layout'

// T#17: helpers shared by the assignment screen specs (read-only spec, per-run-DB spec, screenshots).
export async function openAssignFromList(page: Page, account: DemoAccount, width: number, projectName = '알파 프로젝트'): Promise<void> {
  await loginAs(page, account)
  await page.setViewportSize({ width, height: 800 })
  await page.goto('/projects')
  await page.getByRole('navigation').first().waitFor()
  await page.getByRole('link', { name: projectName }).click()
  await page.getByRole('navigation').first().waitFor()
  await page.getByRole('link', { name: '인력 배치' }).click()
  await page.getByRole('navigation').first().waitFor()
  await settle(page)
}

export const candidatesRegion = (page: Page) => page.getByRole('region', { name: '후보 직원' })
export const currentRegion = (page: Page) => page.getByRole('region', { name: '현재 배치' })
export const percentInput = (page: Page) => page.getByLabel('투입률(%)')
export const assignButton = (page: Page) => page.getByRole('button', { name: '배치', exact: true })

export function fulfil(route: Route, body: unknown, status = 200): Promise<void> {
  return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
}

// Adds N days to "YYYY-MM-DD" in UTC, so the result does not depend on the machine's time zone.
export function addDays(date: string, days: number): string {
  const moment = new Date(`${date}T00:00:00Z`)
  moment.setUTCDate(moment.getUTCDate() + days)
  return moment.toISOString().slice(0, 10)
}

export async function expectHeading(page: Page, name: string): Promise<void> {
  await expect(page.getByRole('heading', { level: 1, name }), 'assignment headings').toHaveCount(1)
}
