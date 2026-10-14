import { expect, test, type Page } from '@playwright/test'
import { PROJECT_MANAGER, loginAs } from './support/auth'
import { expectNoHorizontalOverflow, settle } from './support/layout'
import { SAMPLE, json, stubProjects } from './support/projects'

// T#32 criterion 5: the "인력 부족" column with the real seed (reads only) and with answers the page intercepts. The real
// saves that make a project short of people are in write/project-understaffed.spec.ts.
const WARNING = 'rgb(143, 83, 0)'
const WARNING_BG = 'rgb(253, 241, 220)'

async function open(page: Page, width: number): Promise<void> {
  await loginAs(page, PROJECT_MANAGER)
  await page.setViewportSize({ width, height: 800 })
  await page.goto('/projects')
  await page.getByRole('navigation').first().waitFor()
  await expect(page.locator('main table')).toHaveCount(1)
  await settle(page)
}

for (const width of [1280, 360]) {
  test(`the seeded list has the 인력 부족 column and no badge at ${width}px`, async ({ page }) => {
    await open(page, width)

    // The real API, asked from the page: every item has a boolean and the seed has no project short of people.
    const items = await page.evaluate(async () => {
      const response = await fetch('/api/projects')
      return (await response.json()) as Array<{ name: string; understaffed: unknown }>
    })
    expect(items).toHaveLength(5)
    for (const item of items) {
      expect(typeof item.understaffed, `${item.name} understaffed`).toBe('boolean')
      expect(item.understaffed, `${item.name} understaffed`).toBe(false)
    }
    await expect(page.locator('[data-status="UNDERSTAFFED"]')).toHaveCount(0)

    if (width === 1280) {
      const headers = await page.locator('main thead th').allInnerTexts()
      expect(headers).toHaveLength(6)
      expect(headers[5]).toBe('인력 부족')
    } else {
      // Cards: the sixth line of each card is labelled "인력 부족" and says "—".
      const cells = page.locator('main td[data-label="인력 부족"]')
      await expect(cells).toHaveCount(5)
      expect(await cells.allInnerTexts()).toEqual(['—', '—', '—', '—', '—'])
    }
  })

  test(`a fixed answer with one project short of people draws one warning badge at ${width}px`, async ({ page }) => {
    await stubProjects(page, (route) => json(route, SAMPLE.map((project, index) => ({ ...project, understaffed: index === 0 }))))
    await open(page, width)

    const badges = page.locator('[data-status="UNDERSTAFFED"]')
    await expect(badges).toHaveCount(1)
    await expect(badges).toHaveText('인력 부족')
    expect(await badges.evaluate((el) => [getComputedStyle(el).color, getComputedStyle(el).backgroundColor])).toEqual([
      WARNING,
      WARNING_BG,
    ])
    // The badge sits in the first project's row only.
    await expect(page.locator('main tbody tr').first().locator('[data-status="UNDERSTAFFED"]')).toHaveCount(1)
    await expect(page.locator('main tbody tr').nth(1).locator('[data-status="UNDERSTAFFED"]')).toHaveCount(0)
  })
}

test('the list with the long-named project short of people stays inside the viewport at 1280, 1024, 1023 and 360px', async ({ page }) => {
  await stubProjects(page, (route) => json(route, SAMPLE.map((project, index) => ({ ...project, understaffed: index === 0 }))))
  await open(page, 1280)

  await expectNoHorizontalOverflow(page, [1280, 1024, 1023, 360])
})
