import { expect, test, type Page, type Route } from '@playwright/test'
import { DUAL_MANAGER, EMPLOYEE_ONLY, HR_MANAGER, MANAGERS, loginAs, type DemoAccount } from './support/auth'
import { expectNoHorizontalOverflow, settle } from './support/layout'

// T#6 criteria 7–12 against the real backend (scripts/e2e-servers.sh). Assertions that decide red are immediate
// counts or values, not waiting locators.
const WIDTHS = [1280, 1024, 1023, 360]
const INVALID = '계정 또는 비밀번호가 올바르지 않습니다.'

const pathOf = (page: Page) => new URL(page.url()).pathname
const usernameInput = (page: Page) => page.getByLabel('계정', { exact: true })
const passwordInput = (page: Page) => page.getByLabel('비밀번호', { exact: true })
const loginButton = (page: Page) => page.getByRole('button', { name: '로그인', exact: true })
const logoutButton = (page: Page) => page.locator('header').getByRole('button', { name: '로그아웃' })

async function open(page: Page, url: string): Promise<void> {
  await page.goto(url)
  await page.waitForLoadState('networkidle')
  await settle(page)
}

async function openLogin(page: Page): Promise<void> {
  await open(page, '/login')
  expect(await usernameInput(page).count(), 'login form').toBe(1)
}

async function box(page: Page, selector: string) {
  const rect = await page.locator(selector).first().boundingBox()
  expect(rect, selector).not.toBeNull()
  return rect!
}

test.describe('route protection (criterion 7)', () => {
  test('a logged-out visitor lands on /login from every path', async ({ page }) => {
    for (const url of ['/', '/employees', '/projects', '/me', '/no-such']) {
      await open(page, url)
      expect(pathOf(page), `from ${url}`).toBe('/login')
      expect(await usernameInput(page).count()).toBe(1)
      expect(await page.locator('nav').count()).toBe(0)
    }
  })

  test('an employee-only account is sent to /me from the other paths', async ({ page }) => {
    await loginAs(page, EMPLOYEE_ONLY)
    for (const url of ['/', '/employees', '/projects', '/no-such']) {
      await open(page, url)
      expect(pathOf(page), `from ${url}`).toBe('/me')
    }
  })

  for (const account of MANAGERS) {
    test(`${account.username} is sent to / from /login and unknown paths`, async ({ page }) => {
      await loginAs(page, account)
      for (const url of ['/login', '/no-such']) {
        await open(page, url)
        expect(pathOf(page), `from ${url}`).toBe('/')
      }
    })
  }

  test('a reload keeps the login', async ({ page }) => {
    await loginAs(page, HR_MANAGER)
    await open(page, '/employees')
    await page.reload()
    await page.waitForLoadState('networkidle')
    expect(pathOf(page)).toBe('/employees')
    expect(await page.locator('header').getByText(HR_MANAGER.name).count()).toBe(1)
  })
})

test.describe('login screen (criterion 8)', () => {
  test('a wrong password is explained under the password input, then the right one logs in', async ({ page }) => {
    await openLogin(page)
    await usernameInput(page).fill(HR_MANAGER.username)
    await passwordInput(page).fill('wrong-password')
    await loginButton(page).click()

    const message = page.getByText(INVALID)
    await expect(message).toBeVisible()
    await settle(page)
    expect(pathOf(page)).toBe('/login')
    await expect(passwordInput(page)).toHaveAttribute('aria-invalid', 'true')
    const input = await passwordInput(page).boundingBox()
    const text = await message.boundingBox()
    const gap = text!.y - (input!.y + input!.height)
    expect(gap, 'message right under the input').toBeGreaterThanOrEqual(0)
    expect(gap, 'message right under the input').toBeLessThanOrEqual(4)
    expect(Math.abs(text!.x - input!.x), 'left edges').toBeLessThan(0.5)

    await passwordInput(page).fill(HR_MANAGER.password)
    await loginButton(page).click()
    await page.waitForURL((url) => url.pathname === '/')
    expect(pathOf(page)).toBe('/')
  })
})

test.describe('held responses (criterion 9)', () => {
  test('a held login keeps one request and a busy button of the same width', async ({ page }) => {
    await openLogin(page)
    await usernameInput(page).fill(HR_MANAGER.username)
    await passwordInput(page).fill(HR_MANAGER.password)
    const held: Route[] = []
    await page.route('**/api/auth/login', (route) => {
      held.push(route)
    })
    const idle = await loginButton(page).boundingBox()

    await loginButton(page).click()
    await expect.poll(() => held.length).toBe(1)
    await settle(page)
    expect(await loginButton(page).getAttribute('aria-busy')).toBe('true')
    const busy = await loginButton(page).boundingBox()
    expect(Math.abs(busy!.width - idle!.width), 'button width while loading').toBeLessThanOrEqual(0.5)

    await loginButton(page).click()
    await passwordInput(page).press('Enter')
    await page.waitForTimeout(300)
    expect(held.length, 'requests while the first is held').toBe(1)

    await held[0].continue()
    await page.waitForURL((url) => url.pathname === '/')
    expect(pathOf(page)).toBe('/')
  })

  test('a held login check shows 불러오는 중… and nothing else, then the login form', async ({ page }) => {
    await openLogin(page)
    const held: Route[] = []
    await page.route('**/api/auth/me', (route) => {
      held.push(route)
    })

    await page.goto('/employees')
    await expect.poll(() => held.length).toBe(1)
    expect(await page.getByText('불러오는 중…').count()).toBe(1)
    expect(await usernameInput(page).count()).toBe(0)
    expect(await page.locator('nav').count()).toBe(0)

    await held[0].continue()
    await page.waitForURL((url) => url.pathname === '/login')
    expect(await usernameInput(page).count()).toBe(1)
  })
})

test.describe('user area and menu (criterion 10)', () => {
  const cases: Array<{ account: DemoAccount; labels: string[]; hrefs: string[] }> = [
    ...MANAGERS.map((account) => ({
      account,
      labels: ['대시보드', '직원', '프로젝트'],
      hrefs: ['/', '/employees', '/projects'],
    })),
    { account: EMPLOYEE_ONLY, labels: ['내 정보'], hrefs: ['/me'] },
  ]
  for (const { account, labels, hrefs } of cases) {
    test(`${account.username} sees its name and its menu at 1280px`, async ({ page }) => {
      await loginAs(page, account)
      await open(page, account.home)

      expect(await page.locator('header').getByText(account.name, { exact: true }).count()).toBe(1)
      const links = page.locator('nav a')
      expect(await links.allTextContents()).toEqual(labels)
      expect(await links.evaluateAll((all) => all.map((link) => link.getAttribute('href')))).toEqual(hrefs)
      expect(await links.evaluateAll((all) => all.map((link) => link.getAttribute('aria-current')))).toEqual(
        labels.map((_, index) => (index === 0 ? 'page' : null)),
      )
    })
  }
})

test.describe('logout (criterion 11)', () => {
  test('로그아웃 ends the server session and returns to /login', async ({ page }) => {
    await loginAs(page, DUAL_MANAGER)
    await open(page, '/')
    expect(await logoutButton(page).count()).toBe(1)

    await logoutButton(page).click()
    await page.waitForURL((url) => url.pathname === '/login')
    await open(page, '/')
    expect(pathOf(page)).toBe('/login')
    expect((await page.request.get('/api/auth/me')).status()).toBe(401)
  })
})

test.describe('responsive (criterion 12)', () => {
  test('the login screen fits every width with a card of min(400, width − 32)', async ({ page }) => {
    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: 800 })
      await openLogin(page)
      await expectNoHorizontalOverflow(page, [width])
      const card = await box(page, '[data-testid="login-card"]')
      expect(Math.abs(card.width - Math.min(400, width - 32)), `${width}px card width`).toBeLessThanOrEqual(0.5)
    }
  })

  for (const account of [HR_MANAGER, EMPLOYEE_ONLY]) {
    test(`${account.username}'s ${account.home} fits every width with the user area`, async ({ page }) => {
      await loginAs(page, account)
      for (const width of WIDTHS) {
        await page.setViewportSize({ width, height: 800 })
        await open(page, account.home)
        expect(await logoutButton(page).count(), `${width}px logout button`).toBe(1)
        await expectNoHorizontalOverflow(page, [width])

        const name = page.locator('header').getByText(account.name, { exact: true })
        expect(await name.isVisible(), `${width}px name in the header`).toBe(width >= 1024)
        const logout = await box(page, 'header button')
        expect(logout.x + logout.width, `${width}px logout right edge`).toBeLessThanOrEqual(width)

        if (account === EMPLOYEE_ONLY && width < 1024) {
          const nav = await box(page, 'nav')
          const tab = await box(page, 'nav a')
          expect(Math.abs(tab.width - nav.width), `${width}px single tab width`).toBeLessThanOrEqual(0.5)
        }
      }
    })
  }
})
