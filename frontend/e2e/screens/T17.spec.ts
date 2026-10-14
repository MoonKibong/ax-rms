import { expect, test, type Page } from '@playwright/test'
import { fileURLToPath } from 'node:url'
import { PROJECT_MANAGER } from '../support/auth'
import { assignButton, candidatesRegion, currentRegion, expectHeading, fulfil, openAssignFromList, percentInput } from '../support/assign'
import { settle } from '../support/layout'

// T#17 screens (contract "화면"): the assignment screen of the seeded 알파 프로젝트 with a picked employee, the 100% over
// message (an answer the page intercepts, BRIEF 6.7, D33) and the release dialog, at 1280px and 360px.
const outDir = fileURLToPath(new URL('../../../docs/screens/T17/', import.meta.url))

async function shoot(page: Page, name: string): Promise<void> {
  await page.mouse.move(0, 0)
  await settle(page)
  await page.screenshot({ path: `${outDir}${name}.png`, fullPage: true, animations: 'disabled' })
}

for (const width of [1280, 360]) {
  test(`assign-${width}`, async ({ page }) => {
    await openAssignFromList(page, PROJECT_MANAGER, width)
    await expectHeading(page, '알파 프로젝트')
    await candidatesRegion(page).getByRole('button', { name: '박소영' }).click()
    await expect(page.getByRole('region', { name: '선택한 직원 일정' }).getByRole('img', { name: /알파 프로젝트/ })).toBeVisible()
    await shoot(page, `assign-${width}`)
  })

  test(`over-allocated-${width}`, async ({ page }) => {
    const message = '대상 기간에 투입률 합계가 100%를 초과합니다.'
    await page.route(
      (url) => url.pathname === '/api/assignments',
      (route) => fulfil(route, { code: 'ASSIGNMENT_OVER_ALLOCATED', message }, 400),
    )
    await openAssignFromList(page, PROJECT_MANAGER, width)
    await expectHeading(page, '알파 프로젝트')
    await candidatesRegion(page).getByRole('button', { name: '박소영' }).click()
    await percentInput(page).fill('50')
    await assignButton(page).click()
    await expect(page.getByLabel('투입률(%)')).toHaveAttribute('aria-invalid', 'true')
    await expect(page.getByText(message)).toBeVisible()
    await shoot(page, `over-allocated-${width}`)
  })

  test(`release-dialog-${width}`, async ({ page }) => {
    await openAssignFromList(page, PROJECT_MANAGER, width)
    await expectHeading(page, '알파 프로젝트')
    await currentRegion(page).getByRole('button', { name: '해제' }).first().click()
    await expect(page.getByRole('dialog', { name: '배치 해제' })).toBeVisible()
    await expect(page.getByRole('heading', { name: '배치 해제' })).toBeVisible()
    await shoot(page, `release-dialog-${width}`)
  })
}
