import { render, screen } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import AppRoutes from './AppRoutes'
import { AuthProvider, type CurrentUser } from './auth/AuthContext'
import { DUAL_MANAGER, EMPLOYEE_ONLY, HR_MANAGER, flush, reply } from './test/api'

// T#17 criterion 1: the route /projects/:id/assign and where each role and address goes (contract "라우트와 역할").
function Where() {
  return <output data-testid="where">{useLocation().pathname}</output>
}

const PROJECT_MANAGER_ONLY: CurrentUser = {
  username: 'project.manager',
  employeeId: 4,
  employeeName: '정하늘',
  roles: ['EMPLOYEE', 'PROJECT_MANAGER'],
}

const PROJECT = {
  id: 1,
  name: '알파 프로젝트',
  description: null,
  startDate: '2026-05-16',
  endDate: '2026-09-13',
  status: 'IN_PROGRESS',
  requiredSkills: [],
  requiredHeadcount: 0,
  assignedHeadcount: 0,
  assignments: [],
}

function stubApi(user: CurrentUser | null) {
  const fetchMock = vi.fn((input: RequestInfo | URL) => {
    const url = String(input)
    if (url === '/api/auth/me') return user ? reply(200, user) : reply(401, { code: 'AUTH_REQUIRED', message: '로그인이 필요합니다.' })
    if (url === '/api/projects/1') return reply(200, PROJECT)
    if (url.startsWith('/api/assignments/candidates')) return reply(200, [])
    if (url === '/api/employees') return reply(200, [])
    return reply(404, {})
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

const urls = (fetchMock: ReturnType<typeof stubApi>) => fetchMock.mock.calls.map(([input]) => String(input))

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

describe('AppRoutes project assignment', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it.each([
    ['a project manager', PROJECT_MANAGER_ONLY],
    ['an account with both manager roles', DUAL_MANAGER],
  ])('shows the assignment screen of project 1 at /projects/1/assign to %s', async (_label, user) => {
    const fetchMock = stubApi(user)

    await renderAt('/projects/1/assign')

    expect(where()).toBe('/projects/1/assign')
    expect(screen.getByRole('heading', { level: 1, name: '알파 프로젝트' })).toBeInTheDocument()
    expect(urls(fetchMock)).toContain('/api/projects/1')
  })

  it('sends the HR manager, who only reads, to the project detail without asking for assignment data', async () => {
    const fetchMock = stubApi(HR_MANAGER)

    await renderAt('/projects/1/assign')

    expect(where()).toBe('/projects/1')
    const asked = urls(fetchMock).filter((url) => url.startsWith('/api/assignments') || url === '/api/employees')
    expect(asked).toEqual([])
  })

  it.each(['/projects/abc/assign', '/projects/0/assign', '/projects/-3/assign', '/projects/1.5/assign'])(
    'sends %s to / without any request but the login check',
    async (path) => {
      const fetchMock = stubApi(PROJECT_MANAGER_ONLY)

      await renderAt(path)

      expect(where()).toBe('/')
      expect(urls(fetchMock).filter((url) => url !== '/api/auth/me' && url !== '/api/health')).toEqual([])
    },
  )

  it('sends a logged-out visitor to /login', async () => {
    stubApi(null)

    await renderAt('/projects/1/assign')

    expect(where()).toBe('/login')
  })

  it('sends an employee-only account to /me', async () => {
    stubApi(EMPLOYEE_ONLY)

    await renderAt('/projects/1/assign')

    expect(where()).toBe('/me')
  })
})
