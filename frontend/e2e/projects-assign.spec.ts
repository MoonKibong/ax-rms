import { expect, test, type Page } from '@playwright/test'
import { HR_MANAGER, PROJECT_MANAGER, loginAs } from './support/auth'
import { assignButton, candidatesRegion, currentRegion, expectHeading, fulfil, openAssignFromList, percentInput } from './support/assign'
import { expectNoHorizontalOverflow, settle } from './support/layout'
import { LONG_NAME } from './support/projects'

// T#17 criteria 7-8: the assignment screen with the real seed (reads only) and with answers the page intercepts. A write
// that would reach the shared e2e DB is answered by the page.route stub; the real saves are in write/assignment-write.spec.ts.
const DANGER = 'rgb(191, 43, 27)'

for (const width of [1280, 360]) {
  test(`assignment screen of the seeded project at ${width}px`, async ({ page }) => {
    await openAssignFromList(page, PROJECT_MANAGER, width)

    await expectHeading(page, '알파 프로젝트')
    expect(new URL(page.url()).pathname).toMatch(/^\/projects\/\d+\/assign$/)
    await expect(candidatesRegion(page).getByRole('button', { name: '박소영' })).toBeVisible()
    await expect(candidatesRegion(page).getByRole('button', { name: '최동훈' })).toBeVisible()
    await expect(candidatesRegion(page).getByText('투입 불가', { exact: true })).toHaveCount(1)

    // A table at 1280px, cards at 360px.
    const displays = await page.locator('main table').evaluateAll((tables) => tables.map((t) => getComputedStyle(t).display))
    expect(displays).toEqual(width === 1280 ? ['table', 'table'] : ['block', 'block'])

    await candidatesRegion(page).getByRole('button', { name: '박소영' }).click()
    await expect(page.getByRole('region', { name: '선택한 직원 일정' }).getByRole('img', { name: /알파 프로젝트/ })).toBeVisible()

    await expect(currentRegion(page).locator('tbody tr')).toHaveCount(3)
    expect(await currentRegion(page).locator('tbody tr td:first-child a').allInnerTexts()).toEqual(['권지안', '강민재', '박소영'])
    await expect(assignButton(page)).toBeVisible()
    expect(await percentInput(page).getAttribute('step')).toBe('5')
  })
}

test('the HR manager, who only reads, is sent from the assignment address to the project detail', async ({ page }) => {
  await loginAs(page, PROJECT_MANAGER)
  await page.goto('/projects')
  await page.getByRole('link', { name: '알파 프로젝트' }).click()
  await page.getByRole('navigation').first().waitFor()
  const detail = new URL(page.url()).pathname
  await page.context().clearCookies()

  await loginAs(page, HR_MANAGER)
  await page.goto(`${detail}/assign`)
  await page.getByRole('navigation').first().waitFor()

  expect(new URL(page.url()).pathname).toBe(detail)
  await expectHeading(page, '알파 프로젝트')
})

// The page's own answers: one project, three candidates, one employee schedule.
const PROJECT = {
  id: 7,
  name: LONG_NAME,
  description: null,
  startDate: '2026-05-16',
  endDate: '2026-09-13',
  status: 'IN_PROGRESS',
  requiredSkills: [],
  requiredHeadcount: 2,
  assignedHeadcount: 1,
  assignments: [
    {
      assignmentId: 31,
      employeeId: 2,
      employeeName: LONG_NAME,
      startDate: '2026-05-18',
      endDate: '2026-09-08',
      allocationPercent: 60,
      currentAvailability: 40,
    },
  ],
}

const EMPLOYEES = [
  {
    id: 2,
    name: LONG_NAME,
    departmentId: 1,
    departmentName: LONG_NAME,
    jobTitle: '백엔드 개발자',
    careerYears: 5,
    availabilityStatus: 'AVAILABLE',
    currentAvailability: 40,
    needsReview: false,
    skills: [{ skillName: LONG_NAME, proficiencyLevel: 'ADVANCED' }],
  },
]

const DETAIL = {
  ...EMPLOYEES[0],
  unavailableReason: null,
  unavailableUntil: null,
  assignments: [
    { projectId: 7, projectName: LONG_NAME, projectStatus: 'IN_PROGRESS', startDate: '2026-05-18', endDate: '2026-09-08', allocationPercent: 60 },
  ],
  today: '2026-06-15',
}

async function stubAnswers(page: Page, onWrite?: (method: string, url: string) => void): Promise<void> {
  await page.route((url) => url.pathname === '/api/projects/7', (route) => fulfil(route, PROJECT))
  await page.route((url) => url.pathname === '/api/assignments/candidates', (route) =>
    fulfil(route, [{ employeeId: 2, name: LONG_NAME, availabilityStatus: 'AVAILABLE', periodAvailability: 40 }]),
  )
  await page.route((url) => url.pathname === '/api/employees', (route) => fulfil(route, EMPLOYEES))
  await page.route((url) => url.pathname === '/api/employees/2', (route) => fulfil(route, DETAIL))
  await page.route((url) => url.pathname.startsWith('/api/assignments') && url.pathname !== '/api/assignments/candidates', async (route) => {
    onWrite?.(route.request().method(), route.request().url())
    await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ code: 'UNEXPECTED', message: 'unexpected write' }) })
  })
}

const cause = (code: string, message: string) => ({ code, message })

async function openStubbed(page: Page, width: number): Promise<void> {
  await loginAs(page, PROJECT_MANAGER)
  await page.setViewportSize({ width, height: 800 })
  await page.goto('/projects/7/assign')
  await page.getByRole('navigation').first().waitFor()
  await settle(page)
  await expectHeading(page, LONG_NAME)
  await candidatesRegion(page).getByRole('button', { name: LONG_NAME }).click()
  await settle(page)
}

// The message of an input is its aria-describedby target: right under the input (<= 4px, BRIEF 7 item 6) in the danger colour.
async function expectMessageUnder(page: Page, inputLabel: string, text: string): Promise<void> {
  const input = page.getByLabel(inputLabel)
  await expect(input).toHaveAttribute('aria-invalid', 'true')
  const messageId = await input.getAttribute('aria-describedby')
  const message = page.locator(`[id="${messageId}"]`)
  await expect(message).toHaveText(text)
  const inputBox = (await input.boundingBox())!
  const messageBox = (await message.boundingBox())!
  expect(messageBox.y - (inputBox.y + inputBox.height), `${inputLabel}: gap under the input`).toBeLessThanOrEqual(4)
  expect(messageBox.y, `${inputLabel}: message below the input`).toBeGreaterThanOrEqual(inputBox.y + inputBox.height)
  expect(await message.evaluate((el) => getComputedStyle(el).color)).toBe(DANGER)
}

for (const width of [1280, 360]) {
  test(`violation messages stand where their cause is at ${width}px`, async ({ page }) => {
    let answer = cause('ASSIGNMENT_OVER_ALLOCATED', '대상 기간에 투입률 합계가 100%를 초과합니다.')
    await stubAnswers(page)
    await page.route((url) => url.pathname === '/api/assignments' , (route) => fulfil(route, answer, 400))
    await openStubbed(page, width)
    await percentInput(page).fill('50')

    await assignButton(page).click()
    await expectMessageUnder(page, '투입률(%)', answer.message)

    answer = cause('ASSIGNMENT_OUT_OF_PROJECT_PERIOD', '배치 기간은 프로젝트 기간 안에 있어야 합니다.')
    await percentInput(page).fill('30')
    await assignButton(page).click()
    await expectMessageUnder(page, '종료일', answer.message)

    answer = cause('ASSIGNMENT_EMPLOYEE_UNAVAILABLE', '투입 불가 직원은 새 배치를 받을 수 없습니다.')
    await percentInput(page).fill('20')
    await assignButton(page).click()
    const alert = page.getByRole('alert')
    await expect(alert).toHaveText(answer.message)
    const alertBox = (await alert.boundingBox())!
    const buttonBox = (await assignButton(page).boundingBox())!
    expect(alertBox.y + alertBox.height, 'message above the 배치 button').toBeLessThanOrEqual(buttonBox.y + 0.5)
    expect(await alert.evaluate((el) => getComputedStyle(el).color)).toBe(DANGER)
  })
}

// T#53 criterion 10: a period of more than 366 days is said under the end date (real seed, nothing intercepted, nothing saved).
for (const width of [1280, 360]) {
  test(`a period of more than 366 days is said under the end date at ${width}px`, async ({ page }) => {
    await openAssignFromList(page, PROJECT_MANAGER, width)
    await expectHeading(page, '알파 프로젝트')

    await page.getByLabel('종료일').fill('2027-12-31')
    await expectMessageUnder(page, '종료일', '배치 기간은 최대 366일입니다.')
    await expectNoHorizontalOverflow(page, [width])
  })
}

test('the release dialog opens over the screen, names the assignment and 취소 sends nothing', async ({ page }) => {
  const writes: string[] = []
  await stubAnswers(page, (method, url) => writes.push(`${method} ${url}`))
  await openStubbed(page, 1280)

  await currentRegion(page).getByRole('button', { name: '해제' }).click()

  const dialog = page.getByRole('dialog', { name: '배치 해제' })
  await expect(dialog).toBeVisible()
  await expect(dialog).toContainText('2026-05-18 ~ 2026-09-08 · 60%')
  await dialog.getByRole('button', { name: '취소' }).click()
  await expect(dialog).toHaveCount(0)
  expect(writes).toEqual([])
})

test('the screen with 48-character names stays inside the viewport at 1280, 1024, 1023 and 360px', async ({ page }) => {
  await stubAnswers(page)
  await openStubbed(page, 1280)

  await expectNoHorizontalOverflow(page, [1280, 1024, 1023, 360])
  for (const [width, display] of [
    [1024, 'table'],
    [1023, 'block'],
  ] as const) {
    await page.setViewportSize({ width, height: 800 })
    await settle(page)
    const displays = await page.locator('main table').evaluateAll((tables) => tables.map((t) => getComputedStyle(t).display))
    expect(displays, `${width}px`).toEqual([display, display])
  }
})
