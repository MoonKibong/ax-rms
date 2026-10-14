import { expect, test, type Page } from '@playwright/test'
import { fileURLToPath } from 'node:url'
import { PROJECT_MANAGER, loginAs } from '../support/auth'
import { settle } from '../support/layout'
import { json } from '../support/projects'

// T#34 screens (contract criterion 8) on the shared e2e DB: the two forms with the seeded 알파 프로젝트, the desktop
// notice, and three states from fixed answers. No project write leaves the browser: page.route answers every
// POST/PUT /api/projects….
const outDir = fileURLToPath(new URL('../../../docs/screens/T34/', import.meta.url))

type Detail = {
  id: number
  startDate: string
  assignments: Array<{ employeeName: string; startDate: string; endDate: string }>
}

const nameInput = (page: Page) => page.getByRole('textbox', { name: '프로젝트명', exact: true })
const button = (page: Page, name: string) => page.getByRole('button', { name, exact: true })
const title = (page: Page, name: string) => page.getByRole('heading', { level: 1, name, exact: true })

test.beforeEach(async ({ page }) => {
  await page.route(
    (url) => url.pathname.startsWith('/api/projects'),
    (route) =>
      route.request().method() === 'GET'
        ? route.fallback()
        : json(route, { code: 'E2E_NO_WRITE', message: '공유 DB에는 쓰지 않습니다.' }, 400),
  )
  await loginAs(page, PROJECT_MANAGER)
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

async function alpha(page: Page): Promise<Detail> {
  const response = await page.request.get('/api/projects')
  expect(response.status(), 'GET /api/projects').toBe(200)
  const list = (await response.json()) as Array<{ id: number; name: string }>
  const id = list.find((project) => project.name === '알파 프로젝트')!.id
  return (await (await page.request.get(`/api/projects/${id}`)).json()) as Detail
}

test('form-new-1280', async ({ page }) => {
  await open(page, 1280, '/projects/new')
  expect(await title(page, '프로젝트 등록').count(), '프로젝트 등록').toBe(1)
  await expect(title(page, '프로젝트 등록')).toBeVisible()
  await expect(nameInput(page)).toBeVisible()
  await shoot(page, 'form-new-1280')
})

test('form-edit-1280', async ({ page }) => {
  await open(page, 1280, `/projects/${(await alpha(page)).id}/edit`)
  expect(await title(page, '프로젝트 수정').count(), '프로젝트 수정').toBe(1)
  await expect(title(page, '프로젝트 수정')).toBeVisible()
  await expect(nameInput(page)).toHaveValue('알파 프로젝트')
  await shoot(page, 'form-edit-1280')
})

test('form-notice-360', async ({ page }) => {
  await open(page, 360, '/projects/new')
  expect(await page.getByText('데스크톱에서 이용해 주세요', { exact: true }).count(), 'notice').toBe(1)
  await expect(title(page, '프로젝트 등록')).toBeVisible()
  await expect(page.getByText('데스크톱에서 이용해 주세요', { exact: true })).toBeVisible()
  await expect(nameInput(page)).toBeHidden()
  await shoot(page, 'form-notice-360')
})

test('form-error-1280', async ({ page }) => {
  await page.route(
    (url) => url.pathname === '/api/projects',
    (route) =>
      route.request().method() === 'POST'
        ? json(route, { code: 'PROJECT_NAME_REQUIRED', message: '프로젝트명을 입력하세요.' }, 400)
        : route.fallback(),
  )
  await open(page, 1280, '/projects/new')
  expect(await title(page, '프로젝트 등록').count(), '프로젝트 등록').toBe(1)
  await expect(title(page, '프로젝트 등록')).toBeVisible()
  await button(page, '저장').click()
  await expect(page.getByText('프로젝트명을 입력하세요.', { exact: true })).toBeVisible()
  await expect(nameInput(page)).toHaveAttribute('aria-invalid', 'true')
  await shoot(page, 'form-error-1280')
})

test('form-period-error-1280', async ({ page }) => {
  const project = await alpha(page)
  // The server's D30 answer (T#9 format) when the end moves to the day before the earliest assignment end: every
  // assignment falls outside, so the message lists three.
  const earliest = [...project.assignments].sort((a, b) => a.endDate.localeCompare(b.endDate))[0].endDate
  const day = new Date(`${earliest}T00:00:00Z`)
  day.setUTCDate(day.getUTCDate() - 1)
  const newEnd = day.toISOString().slice(0, 10)
  const outside = [...project.assignments]
    .filter((assignment) => assignment.endDate > newEnd || assignment.startDate < project.startDate)
    .sort((a, b) => a.startDate.localeCompare(b.startDate) || a.employeeName.localeCompare(b.employeeName))
  const message =
    `프로젝트 기간을 바꾸면 기간 밖으로 나가는 배정 ${outside.length}건이 있어 저장할 수 없습니다: ` +
    outside
      .slice(0, 3)
      .map((assignment) => `${assignment.employeeName} ${assignment.startDate} ~ ${assignment.endDate}`)
      .join(', ')
  await page.route(
    (url) => url.pathname === `/api/projects/${project.id}`,
    (route) =>
      route.request().method() === 'PUT'
        ? json(route, { code: 'PROJECT_PERIOD_EXCLUDES_ASSIGNMENTS', message }, 400)
        : route.fallback(),
  )
  await open(page, 1280, `/projects/${project.id}/edit`)
  expect(await title(page, '프로젝트 수정').count(), '프로젝트 수정').toBe(1)
  await expect(title(page, '프로젝트 수정')).toBeVisible()
  await expect(nameInput(page)).toHaveValue('알파 프로젝트')
  await page.getByLabel('종료일').fill(newEnd)
  await button(page, '저장').click()
  await expect(page.getByText(message, { exact: true })).toBeVisible()
  await expect(page.getByRole('group', { name: '기간', exact: true })).toHaveAttribute('aria-invalid', 'true')
  await shoot(page, 'form-period-error-1280')
})

test('form-load-error-1280', async ({ page }) => {
  const id = (await alpha(page)).id
  await page.route(
    (url) => url.pathname === `/api/projects/${id}`,
    (route) => json(route, { code: 'X', message: '서버 오류' }, 500),
  )
  await open(page, 1280, `/projects/${id}/edit`)
  expect(await title(page, '프로젝트 수정').count(), '프로젝트 수정').toBe(1)
  await expect(title(page, '프로젝트 수정')).toBeVisible()
  await expect(page.getByText('데이터를 불러오지 못했습니다', { exact: true })).toBeVisible()
  await expect(page.getByRole('alert').filter({ hasText: '서버 오류' })).toBeVisible()
  await expect(button(page, '다시 시도')).toBeVisible()
  await shoot(page, 'form-load-error-1280')
})
