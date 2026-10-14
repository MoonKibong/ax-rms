import { expect, test, type Page } from '@playwright/test'
import { fileURLToPath } from 'node:url'
import { PROJECT_MANAGER, loginAs } from '../support/auth'
import { settle } from '../support/layout'
import { SAMPLE, json, stubProjects } from '../support/projects'

// T#32 screens (contract "화면"): the project list with its 인력 부족 column, from the real seed (no badge) and from an
// answer the page intercepts (one project short of people), at 1280px and 360px.
const outDir = fileURLToPath(new URL('../../../docs/screens/T32/', import.meta.url))

async function shoot(page: Page, name: string): Promise<void> {
  await page.mouse.move(0, 0)
  await settle(page)
  await page.screenshot({ path: `${outDir}${name}.png`, fullPage: true, animations: 'disabled' })
}

async function open(page: Page, width: number): Promise<void> {
  await loginAs(page, PROJECT_MANAGER)
  await page.setViewportSize({ width, height: 800 })
  await page.goto('/projects')
  await page.getByRole('navigation').first().waitFor()
  await expect(page.getByRole('heading', { level: 1, name: '프로젝트' })).toBeVisible()
  await expect(page.locator('main table')).toHaveCount(1)
}

// 1280px: the header "인력 부족" is on the screen; 360px: the card line labelled "인력 부족" is.
async function expectColumn(page: Page, width: number): Promise<void> {
  if (width === 1280) {
    await expect(page.getByRole('columnheader', { name: '인력 부족' })).toBeVisible()
  } else {
    await expect(page.locator('main td[data-label="인력 부족"]').first()).toBeVisible()
  }
}

for (const width of [1280, 360]) {
  test(`list-${width}`, async ({ page }) => {
    await open(page, width)
    await expectColumn(page, width)
    await expect(page.getByRole('link', { name: '알파 프로젝트' })).toBeVisible()
    await shoot(page, `list-${width}`)
  })

  test(`list-understaffed-${width}`, async ({ page }) => {
    await stubProjects(page, (route) => json(route, SAMPLE.map((project, index) => ({ ...project, understaffed: index === 0 }))))
    await open(page, width)
    await expectColumn(page, width)
    await expect(page.locator('[data-status="UNDERSTAFFED"]')).toBeVisible()
    await shoot(page, `list-understaffed-${width}`)
  })
}
