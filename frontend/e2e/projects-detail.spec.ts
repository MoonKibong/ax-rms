import { expect, test, type Page } from '@playwright/test'
import { HR_MANAGER, PROJECT_MANAGER, loginAs, type DemoAccount } from './support/auth'
import { expectNoHorizontalOverflow, settle } from './support/layout'
import { LONG_NAME, json } from './support/projects'

// T#16: the project detail screen and the "프로젝트 등록" button on the list. Reads the real seed only (criterion 4);
// the 48-character name comes from an answer that the test replaces (criterion 5).
const filterGroup = (page: Page) => page.getByRole('group', { name: '상태 필터' })

async function open(page: Page, width: number, path: string): Promise<void> {
  await page.setViewportSize({ width, height: 800 })
  await page.goto(path)
  // The app first asks who is logged in (GET /api/auth/me); the shell, with its navigation, comes after that.
  await page.getByRole('navigation').first().waitFor()
  await settle(page)
}

// Opens the detail of the seeded "알파 프로젝트" the way a person does: from the list.
async function openAlpha(page: Page, account: DemoAccount, width: number): Promise<void> {
  await loginAs(page, account)
  await open(page, width, '/projects')
  await page.getByRole('link', { name: '알파 프로젝트' }).click()
  await page.getByRole('navigation').first().waitFor()
  await settle(page)
}

for (const width of [1280, 360]) {
  test(`detail of the seeded project at ${width}px`, async ({ page }) => {
    await openAlpha(page, PROJECT_MANAGER, width)

    // The heading comes with the answer, so wait for it before counting anything else.
    await expect(page.getByRole('heading', { level: 1, name: '알파 프로젝트' }), 'detail headings').toHaveCount(1)
    expect(new URL(page.url()).pathname).toMatch(/^\/projects\/\d+$/)
    const projectId = new URL(page.url()).pathname.split('/').pop()

    const badge = page.locator('main [data-status]').first()
    await expect(badge).toHaveText('진행 중')
    expect(await badge.evaluate((el) => [getComputedStyle(el).color, getComputedStyle(el).backgroundColor])).toEqual([
      'rgb(41, 82, 204)',
      'rgb(238, 241, 245)',
    ])
    await expect(page.getByText(/^필요 2명 \/ 배치 \d+명$/)).toBeVisible()

    const skills = page.getByRole('region', { name: '필요 역량' })
    await expect(skills.locator('tbody tr')).toHaveCount(1)
    expect(await skills.locator('tbody tr').first().locator('td').allInnerTexts()).toEqual(['백엔드 개발자', 'Java', '중급', '2'])
    const assigned = page.getByRole('region', { name: '배치 인력' })
    await expect(assigned.locator('tbody tr')).toHaveCount(3)
    expect(await assigned.locator('tbody tr td:first-child a').allInnerTexts()).toEqual(['권지안', '강민재', '박소영'])

    // BRIEF 6.6 order: the button row comes after the 배치 인력 table, not beside the title.
    const assignBox = await page.getByRole('link', { name: '인력 배치' }).boundingBox()
    const assignedBox = await page.getByRole('region', { name: '배치 인력' }).boundingBox()
    expect(assignBox!.y, 'button row below the 배치 인력 table').toBeGreaterThanOrEqual(assignedBox!.y + assignedBox!.height)

    // Tables at 1280px, cards at 360px (DataTable).
    const displays = await page.locator('main table').evaluateAll((tables) => tables.map((t) => getComputedStyle(t).display))
    expect(displays).toEqual(width === 1280 ? ['table', 'table'] : ['block', 'block'])
    if (width === 1280) {
      expect(await skills.locator('th').count()).toBe(4)
      expect(await assigned.locator('th').count()).toBe(3)
    }

    // 인력 배치 at both widths; 수정 only from 1024px (display: none below).
    const assign = page.getByRole('link', { name: '인력 배치' })
    await expect(assign).toBeVisible()
    await expect(assign).toHaveAttribute('href', `/projects/${projectId}/assign`)
    // Found by address: a link with display: none is not in the accessibility tree at 360px.
    const edit = page.locator(`a[href="/projects/${projectId}/edit"]`)
    await expect(edit).toHaveText('수정')
    await expect(edit).toHaveAttribute('href', `/projects/${projectId}/edit`)
    expect(await edit.evaluate((el) => getComputedStyle(el).display)).toBe(width === 1280 ? 'flex' : 'none')
    if (width === 1280) {
      await expect(edit).toBeVisible()
    } else {
      await expect(edit).toBeHidden()
    }
  })

  test(`register button on the list at ${width}px`, async ({ page }) => {
    await loginAs(page, PROJECT_MANAGER)
    await open(page, width, '/projects')

    expect(await filterGroup(page).count(), 'status filters').toBe(1)
    // By address: a link with display: none is not in the accessibility tree at 360px.
    const register = page.locator('a[href="/projects/new"]')
    expect(await register.count(), 'register links').toBe(1)
    await expect(register).toHaveAttribute('href', '/projects/new')
    await expect(register).toHaveText('프로젝트 등록')
    expect(await register.evaluate((el) => getComputedStyle(el).display)).toBe(width === 1280 ? 'flex' : 'none')
    // Right of the title, on the same line (wide).
    if (width === 1280) {
      const title = await page.getByRole('heading', { level: 1, name: '프로젝트' }).boundingBox()
      const button = await register.boundingBox()
      expect(button!.x).toBeGreaterThan(title!.x + title!.width)
      expect(Math.abs(button!.y + button!.height / 2 - (title!.y + title!.height / 2))).toBeLessThan(title!.height)
    }
  })
}

test('the HR manager sees the detail and the list but none of the write buttons', async ({ page }) => {
  await openAlpha(page, HR_MANAGER, 1280)

  await expect(page.getByRole('heading', { level: 1, name: '알파 프로젝트' }), 'detail headings').toHaveCount(1)
  await expect(page.getByRole('region', { name: '필요 역량' })).toBeVisible()
  expect(await page.getByRole('link', { name: '인력 배치' }).count()).toBe(0)
  expect(await page.locator('a[href$="/edit"]').count()).toBe(0)
  await open(page, 1280, '/projects')
  await expect(page.getByRole('link', { name: '알파 프로젝트' })).toBeVisible()
  expect(await page.locator('a[href="/projects/new"]').count()).toBe(0)
})

test('a missing project says so, and addresses that are not a project go to /', async ({ page }) => {
  await loginAs(page, PROJECT_MANAGER)
  await open(page, 1280, '/projects/99999')
  await expect(page.getByText('프로젝트를 찾을 수 없습니다')).toBeVisible()
  await expect(page.getByRole('link', { name: '프로젝트 목록' })).toHaveAttribute('href', '/projects')

  // /projects/new and /projects/:id/edit are the forms of T#34 (project-form.spec.ts).
  for (const path of ['/projects/abc']) {
    await open(page, 1280, path)
    expect(new URL(page.url()).pathname, path).toBe('/')
  }
})

test('the detail with a 48-character name stays inside the screen at 1280, 1024, 1023 and 360px', async ({ page }) => {
  await loginAs(page, PROJECT_MANAGER)
  const detail = {
    id: 7,
    name: LONG_NAME,
    description: LONG_NAME + LONG_NAME,
    startDate: '2026-05-16',
    endDate: '2026-09-13',
    status: 'IN_PROGRESS',
    requiredSkills: [{ jobTitle: LONG_NAME, skillName: LONG_NAME, proficiencyLevel: 'ADVANCED', headcount: 12 }],
    requiredHeadcount: 12,
    assignedHeadcount: 1,
    assignments: [
      {
        assignmentId: 1,
        employeeId: 2,
        employeeName: LONG_NAME,
        startDate: '2026-05-18',
        endDate: '2026-09-08',
        allocationPercent: 100,
        currentAvailability: 0,
      },
    ],
  }
  await page.route((url) => url.pathname === '/api/projects/7', (route) => json(route, detail))
  await open(page, 1280, '/projects/7')

  await expect(page.getByRole('heading', { level: 1, name: LONG_NAME }), 'detail headings').toHaveCount(1)
  await expect(page.locator('main table')).toHaveCount(2)
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

test('a project without a description shows — in the muted text colour, below the title', async ({ page }) => {
  await loginAs(page, PROJECT_MANAGER)
  const detail = {
    id: 8,
    name: '설명 없는 프로젝트',
    description: null,
    startDate: '2026-05-16',
    endDate: '2026-09-13',
    status: 'PLANNED',
    requiredSkills: [],
    requiredHeadcount: 0,
    assignedHeadcount: 0,
    assignments: [],
  }
  await page.route((url) => url.pathname === '/api/projects/8', (route) => json(route, detail))
  await open(page, 1280, '/projects/8')

  const dash = page.getByText('—', { exact: true })
  await expect(dash).toHaveCount(1)
  // --color-text-muted #55606E
  expect(await dash.evaluate((el) => getComputedStyle(el).color)).toBe('rgb(85, 96, 110)')
})
