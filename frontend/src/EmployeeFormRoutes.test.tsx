import { render, screen } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import AppRoutes from './AppRoutes'
import { AuthProvider, type CurrentUser } from './auth/AuthContext'
import { DUAL_MANAGER, EMPLOYEE_ONLY, HR_MANAGER, flush, reply } from './test/api'
import { PARK_DETAIL, PROJECT_MANAGER } from './test/employees'

// T#39 criterion 4: /employees/new and /employees/:id/edit behind the T#6 login check (contract "경로와 역할"). The
// T#6 tests in AppRoutes.test.tsx and the T#38 tests in EmployeeRoutes.test.tsx stay as they are.
const DEPARTMENTS = [
  { id: 1, name: '개발팀' },
  { id: 2, name: '기획팀' },
  { id: 3, name: '디자인팀' },
]

function Where() {
  return <output data-testid="where">{useLocation().pathname}</output>
}

function stubApi(me: CurrentUser | null) {
  const fetchMock = vi.fn((input: RequestInfo | URL) => {
    const url = String(input)
    if (url === '/api/auth/me') {
      return me ? reply(200, me) : reply(401, { code: 'AUTH_REQUIRED', message: '로그인이 필요합니다.' })
    }
    if (url === '/api/departments') return reply(200, DEPARTMENTS)
    if (url === '/api/employees/1') return reply(200, PARK_DETAIL)
    if (url === '/api/employees') return reply(200, [])
    if (url === '/api/me/employee') return reply(200, PARK_DETAIL)
    return reply(404, {})
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

// Every request but the login check.
function asked(fetchMock: ReturnType<typeof stubApi>): string[] {
  return fetchMock.mock.calls.map(([input]) => String(input)).filter((url) => url !== '/api/auth/me')
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

describe('employee form routes', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  for (const path of ['/employees/new', '/employees/1/edit']) {
    it(`sends a logged-out visitor from ${path} to the login form`, async () => {
      const fetchMock = stubApi(null)

      await renderAt(path)

      expect(where()).toBe('/login')
      expect(asked(fetchMock)).toEqual([])
    })

    it(`sends an employee-only account from ${path} to 내 정보`, async () => {
      stubApi(EMPLOYEE_ONLY)

      await renderAt(path)

      expect(where()).toBe('/me')
    })
  }

  it('sends project.manager from /employees/new to the list', async () => {
    stubApi(PROJECT_MANAGER)
    await renderAt('/employees/new')
    expect(where()).toBe('/employees')
  })

  it('sends project.manager from /employees/1/edit to the detail', async () => {
    stubApi(PROJECT_MANAGER)
    await renderAt('/employees/1/edit')
    expect(where()).toBe('/employees/1')
  })

  for (const user of [HR_MANAGER, DUAL_MANAGER]) {
    it(`shows ${user.username} the registration form at /employees/new without asking for an employee "new"`, async () => {
      const fetchMock = stubApi(user)

      await renderAt('/employees/new')

      expect(where()).toBe('/employees/new')
      expect(screen.getByRole('heading', { level: 1, name: '직원 등록' })).toBeInTheDocument()
      expect(asked(fetchMock)).not.toContain('/api/employees/new')
    })

    it(`shows ${user.username} the edit form at /employees/1/edit`, async () => {
      stubApi(user)

      await renderAt('/employees/1/edit')

      expect(where()).toBe('/employees/1/edit')
      expect(screen.getByRole('heading', { level: 1, name: '직원 수정' })).toBeInTheDocument()
    })
  }

  it('asks nothing for /employees/abc/edit and says the employee was not found', async () => {
    const fetchMock = stubApi(HR_MANAGER)

    await renderAt('/employees/abc/edit')

    expect(where()).toBe('/employees/abc/edit')
    expect(screen.getAllByText('직원을 찾을 수 없습니다.').length).toBeGreaterThan(0)
    expect(asked(fetchMock)).toEqual([])
  })
})
