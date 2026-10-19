import { expect, test, type Page } from '@playwright/test'
import { fileURLToPath } from 'node:url'
import { PROJECT_MANAGER, loginAs } from '../support/auth'
import { assignButton, candidatesRegion, expectHeading, fulfil, openAssignFromList, percentInput } from '../support/assign'
import { settle } from '../support/layout'

// T#58 screens (contract "화면"): the project form after the real server refuses an inverted period (1280px and 1024px:
// below 1024px the form is hidden, D29), and the assignment screen when the project cannot be asked for again after a
// save (1280px and 360px; that answer is a 500 the page intercepts, the save itself is answered by the page too).
const outDir = fileURLToPath(new URL('../../../docs/screens/T58/', import.meta.url))

async function shoot(page: Page, name: string): Promise<void> {
  await page.mouse.move(0, 0)
  await settle(page)
  await page.screenshot({ path: `${outDir}${name}.png`, fullPage: true, animations: 'disabled' })
}

for (const width of [1280, 1024]) {
  test(`project-form-period-error-${width}`, async ({ page }) => {
    await loginAs(page, PROJECT_MANAGER)
    await page.setViewportSize({ width, height: 800 })
    await page.goto('/projects/new')
    await page.getByRole('navigation').first().waitFor()
    await page.waitForLoadState('networkidle')
    await page.getByRole('textbox', { name: '프로젝트명', exact: true }).fill('포커스 확인')
    await page.getByLabel('시작일').fill('2026-12-31')
    await page.getByLabel('종료일').fill('2026-01-01')
    await page.getByRole('combobox', { name: '상태', exact: true }).selectOption({ label: '진행 중' })
    // The real server answers with 400 and writes nothing.
    await page.getByRole('button', { name: '저장', exact: true }).click()
    await expect(page.getByLabel('시작일')).toHaveAttribute('aria-invalid', 'true')
    await expect(page.getByLabel('시작일')).toBeFocused()
    await shoot(page, `project-form-period-error-${width}`)
  })
}

for (const width of [1280, 360]) {
  test(`assign-reload-failed-${width}`, async ({ page }) => {
    let saved = false
    await page.route(
      (url) => url.pathname === '/api/assignments',
      (route) => {
        if (route.request().method() !== 'POST') return route.fallback()
        saved = true
        return fulfil(route, { id: 900, employeeId: 1, projectId: 1, startDate: '2026-01-01', endDate: '2026-01-02', allocationPercent: 30 }, 201)
      },
    )
    await page.route(
      (url) => /^\/api\/projects\/\d+$/.test(url.pathname),
      (route) => (saved ? fulfil(route, { code: 'UNEXPECTED', message: 'x' }, 500) : route.fallback()),
    )
    await openAssignFromList(page, PROJECT_MANAGER, width)
    await expectHeading(page, '알파 프로젝트')
    await candidatesRegion(page).getByRole('button').first().click()
    await percentInput(page).fill('30')
    await assignButton(page).click()
    await expect(page.getByRole('alert')).toHaveText('프로젝트를 다시 불러오지 못했습니다.')
    await expectHeading(page, '알파 프로젝트')
    await expect(page.getByRole('button', { name: '다시 불러오기' })).toBeVisible()
    await shoot(page, `assign-reload-failed-${width}`)
  })
}
