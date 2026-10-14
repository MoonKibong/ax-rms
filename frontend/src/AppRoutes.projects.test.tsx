import { render, screen } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import AppRoutes from './AppRoutes'
import { AuthProvider, type CurrentUser } from './auth/AuthContext'
import { DUAL_MANAGER, EMPLOYEE_ONLY, flush, reply } from './test/api'

// T#16 criterion 2: the detail route and what happens to addresses that are not a project id (contract "라우트").
function Where() {
  return <output data-testid="where">{useLocation().pathname}</output>
}

const DETAIL = {
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
    if (url === '/api/health') return reply(200, { status: 'UP' })
    if (url === '/api/projects/1') return reply(200, DETAIL)
    if (url === '/api/projects') return reply(200, [])
    return reply(404, {})
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
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

describe('AppRoutes project detail', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('shows the detail of project 1 at /projects/1', async () => {
    const fetchMock = stubApi(DUAL_MANAGER)

    await renderAt('/projects/1')

    expect(where()).toBe('/projects/1')
    expect(screen.getByRole('heading', { level: 1, name: '알파 프로젝트' })).toBeInTheDocument()
    expect(fetchMock.mock.calls.map(([input]) => String(input))).toContain('/api/projects/1')
  })

  // /projects/new and /projects/:id/edit are the forms of T#34 (ProjectFormRoutes.test.tsx).
  it.each(['/projects/abc', '/projects/0', '/projects/-3', '/projects/1.5'])(
    'sends %s to / without asking for a project',
    async (path) => {
      const fetchMock = stubApi(DUAL_MANAGER)

      await renderAt(path)

      expect(where()).toBe('/')
      const asked = fetchMock.mock.calls.map(([input]) => String(input))
      expect(asked.filter((url) => url.startsWith('/api/projects'))).toEqual([])
    },
  )

  it('keeps the T#6 rules: logged out goes to /login, an employee-only account to /me', async () => {
    stubApi(null)
    await renderAt('/projects/1')
    expect(where()).toBe('/login')
  })

  it('sends an employee-only account from /projects/1 to /me', async () => {
    stubApi(EMPLOYEE_ONLY)

    await renderAt('/projects/1')

    expect(where()).toBe('/me')
  })
})
