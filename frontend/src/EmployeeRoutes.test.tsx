import { render, screen, within } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import AppRoutes from './AppRoutes'
import { AuthProvider, type CurrentUser } from './auth/AuthContext'
import { DUAL_MANAGER, EMPLOYEE_ONLY, HR_MANAGER, flush, reply } from './test/api'
import { HAN_DETAIL, LEE_DETAIL, PARK_DETAIL, PROJECT_MANAGER } from './test/employees'

// T#38 criterion 5: /employees/:id and /me behind the T#6 login check (contract "경로"). The T#6 tests in
// AppRoutes.test.tsx stay as they are.
function Where() {
  return <output data-testid="where">{useLocation().pathname}</output>
}

function stubApi(me: CurrentUser | null) {
  const fetchMock = vi.fn((input: RequestInfo | URL) => {
    const url = String(input)
    if (url === '/api/auth/me') {
      return me ? reply(200, me) : reply(401, { code: 'AUTH_REQUIRED', message: '로그인이 필요합니다.' })
    }
    if (url === '/api/employees/1') return reply(200, PARK_DETAIL)
    if (url === '/api/me/employee') return reply(200, me?.employeeId === HAN_DETAIL.id ? HAN_DETAIL : LEE_DETAIL)
    return reply(404, {})
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function calls(fetchMock: ReturnType<typeof stubApi>, url: string) {
  return fetchMock.mock.calls.filter(([input]) => String(input) === url).length
}

async function renderAt(path: string) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <AppRoutes />
        <Where />
      </AuthProvider>
    </MemoryRouter>,
  )
  await flush()
}

const where = () => screen.getByTestId('where').textContent

describe('employee detail and 내 정보 routes', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('sends a logged-out visitor from /employees/1 to the login form without asking for the employee', async () => {
    const fetchMock = stubApi(null)

    await renderAt('/employees/1')

    expect(where()).toBe('/login')
    expect(screen.getByLabelText('계정')).toBeInTheDocument()
    expect(calls(fetchMock, '/api/employees/1')).toBe(0)
  })

  it('sends an employee-only account from /employees/1 to 내 정보 without asking for the employee', async () => {
    const fetchMock = stubApi(EMPLOYEE_ONLY)

    await renderAt('/employees/1')

    expect(where()).toBe('/me')
    expect(calls(fetchMock, '/api/employees/1')).toBe(0)
  })

  for (const user of [HR_MANAGER, PROJECT_MANAGER, DUAL_MANAGER]) {
    it(`shows ${user.username} the employee detail at /employees/1 with 직원 as the current menu item`, async () => {
      const fetchMock = stubApi(user)

      await renderAt('/employees/1')

      expect(where()).toBe('/employees/1')
      expect(calls(fetchMock, '/api/employees/1')).toBe(1)
      expect(screen.getByRole('heading', { level: 1, name: '박소영' })).toBeInTheDocument()
      expect(within(screen.getByRole('navigation')).getByRole('link', { name: '직원' })).toHaveAttribute(
        'aria-current',
        'page',
      )
    })
  }

  it('sends a logged-out visitor from /me to the login form', async () => {
    stubApi(null)

    await renderAt('/me')

    expect(where()).toBe('/login')
  })

  for (const user of [HR_MANAGER, PROJECT_MANAGER, EMPLOYEE_ONLY, DUAL_MANAGER]) {
    it(`shows ${user.username} 내 정보 at /me`, async () => {
      stubApi(user)

      await renderAt('/me')

      expect(where()).toBe('/me')
      expect(screen.getByRole('heading', { level: 1, name: '내 정보' })).toBeInTheDocument()
    })
  }
})
