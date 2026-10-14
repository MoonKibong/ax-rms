import { expect, test, type APIRequestContext, type Page } from '@playwright/test'
import { fileURLToPath } from 'node:url'
import { addDays, assignButton, candidatesRegion, currentRegion, percentInput } from '../support/assign'
import { PROJECT_MANAGER, loginAs } from '../support/auth'
import { openAt, region } from '../support/dashboard'
import { settle } from '../support/layout'

// T#19 screens (contract criterion 7, D36 "배치 전후 세 화면의 스크린샷"): the dashboard, 박소영's detail and the beta
// project's detail before and after one real assignment (박소영, 베타 프로젝트, today ~ today+30, 30%), at 1280px and 360px,
// full page. The assignment is really saved, so this spec runs only on the per-run DB of `make screenshots`
// (scripts/e2e-servers.sh --fresh-db); the values on each screen are asserted before it is taken.
const outDir = fileURLToPath(new URL('../../../docs/screens/T19/', import.meta.url))
const PARK = '박소영'
const BETA = '베타 프로젝트'

test.describe.configure({ mode: 'serial' })

test.beforeAll(() => {
  // Never against the shared e2e DB: without the runner's mark this spec fails before sending anything.
  if (process.env.E2E_DB !== 'fresh') {
    throw new Error('T19 스크린샷은 scripts/e2e-servers.sh --fresh-db로만 실행합니다 (E2E_DB=fresh 아님)')
  }
})

const ids = { park: 0, beta: 0, today: '' }

async function idOf(request: APIRequestContext, path: string, name: string): Promise<number> {
  const response = await request.get(path)
  expect(response.status(), `GET ${path}`).toBe(200)
  return ((await response.json()) as Array<{ id: number; name: string }>).find((item) => item.name === name)!.id
}

async function shoot(page: Page, name: string): Promise<void> {
  await page.mouse.move(0, 0)
  await settle(page)
  await page.screenshot({ path: `${outDir}${name}.png`, fullPage: true, animations: 'disabled' })
}

// The three screens at one width, each after its values are on it: 박소영's current availability and the beta rows.
async function shootThree(page: Page, width: number, when: 'before' | 'after'): Promise<void> {
  const park = when === 'before' ? '40%' : '10%'
  const betaRows = when === 'before' ? 3 : 4

  await openAt(page, width, '/')
  await expect(page.getByRole('heading', { level: 1, name: '대시보드' })).toBeVisible()
  await expect(
    region(page, '직원별 가용률')
      .getByRole('listitem')
      .filter({ has: page.getByRole('link', { name: PARK, exact: true }) })
      .locator('.dashboard-list__value'),
  ).toHaveText(park)
  await shoot(page, `${when}-dashboard-${width}`)

  await openAt(page, width, `/employees/${ids.park}`)
  await expect(page.getByTestId('employee-name')).toHaveText(PARK)
  await expect(page.getByTestId('current-availability')).toHaveText(park)
  await shoot(page, `${when}-employee-${width}`)

  await openAt(page, width, `/projects/${ids.beta}`)
  await expect(page.getByRole('heading', { level: 1, name: BETA })).toBeVisible()
  await expect(page.getByRole('region', { name: '배치 인력' }).locator('tbody tr')).toHaveCount(betaRows)
  await expect(page.getByText(`필요 2명 / 배치 ${betaRows}명`, { exact: true })).toBeVisible()
  await shoot(page, `${when}-project-${width}`)
}

for (const width of [1280, 360]) {
  test(`before-${width}`, async ({ page }) => {
    await loginAs(page, PROJECT_MANAGER)
    ids.park = await idOf(page.request, '/api/employees', PARK)
    ids.beta = await idOf(page.request, '/api/projects', BETA)
    await shootThree(page, width, 'before')
  })
}

test('assign 박소영 to the beta project, 30%', async ({ page }) => {
  await loginAs(page, PROJECT_MANAGER)
  const detail = await page.request.get(`/api/employees/${ids.park}`)
  ids.today = ((await detail.json()) as { today: string }).today
  const end = addDays(ids.today, 30)
  await openAt(page, 1280, `/projects/${ids.beta}/assign`)
  await expect(candidatesRegion(page)).toBeVisible()
  const answered = page.waitForResponse(
    (response) => response.url().includes('/api/assignments/candidates') && response.url().includes(`startDate=${ids.today}`) && response.url().includes(`endDate=${end}`),
  )
  await page.getByLabel('시작일').fill(ids.today)
  await page.getByLabel('종료일').fill(end)
  await answered
  await candidatesRegion(page).getByRole('button', { name: PARK, exact: true }).click()
  await percentInput(page).fill('30')
  await assignButton(page).click()
  await expect(
    currentRegion(page).locator('tbody tr', { has: page.getByRole('link', { name: PARK, exact: true }) }).locator('td').nth(2),
  ).toHaveText('30%')
})

for (const width of [1280, 360]) {
  test(`after-${width}`, async ({ page }) => {
    await loginAs(page, PROJECT_MANAGER)
    await shootThree(page, width, 'after')
  })
}
