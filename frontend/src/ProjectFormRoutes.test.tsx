import { render, screen } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ProjectDetail } from './api/projects'
import AppRoutes from './AppRoutes'
import { AuthProvider, type CurrentUser } from './auth/AuthContext'
import { DUAL_MANAGER, EMPLOYEE_ONLY, HR_MANAGER, flush, reply } from './test/api'
import { PROJECT_MANAGER } from './test/employees'

// T#34 criterion 1: /projects/new and /projects/:id/edit behind the T#6 login check (contract "경로와 역할"). The
// T#6 tests in AppRoutes.test.tsx and the T#16 tests in AppRoutes.projects.test.tsx stay as they are, but for the two
// addresses T#16 handed over to this task.
const ALPHA: ProjectDetail = {
  id: 1,
  name: '알파 프로젝트',
  description: '사내 포털 리뉴얼',
  startDate: '2026-05-16',
  endDate: '2026-09-13',
  status: 'IN_PROGRESS',
  requiredSkills: [{ jobTitle: '백엔드 개발자', skillName: 'Java', proficiencyLevel: 'INTERMEDIATE', headcount: 2 }],
  requiredHeadcount: 2,
  assignedHeadcount: 0,
  assignments: [],
}

function Where() {
  return <output data-testid="where">{useLocation().pathname}</output>
}

function stubApi(me: CurrentUser | null) {
  const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    if (url === '/api/auth/me') {
      return me ? reply(200, me) : reply(401, { code: 'AUTH_REQUIRED', message: '로그인이 필요합니다.' })
    }
    if ((init?.method ?? 'GET') !== 'GET') return reply(400, { code: 'E2E_NO_WRITE', message: 'no write' })
    if (url === '/api/projects/1') return reply(200, ALPHA)
    if (url.startsWith('/api/projects')) return reply(200, [])
    if (url === '/api/me/employee') return reply(404, {})
    return reply(404, {})
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

// Every request but the login check, with its method.
function asked(fetchMock: ReturnType<typeof stubApi>): string[] {
  return fetchMock.mock.calls
    .filter(([input]) => String(input) !== '/api/auth/me')
    .map(([input, init]) => `${init?.method ?? 'GET'} ${String(input)}`)
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

describe('project form routes', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  for (const path of ['/projects/new', '/projects/1/edit']) {
    it(`sends a logged-out visitor from ${path} to the login form (regression)`, async () => {
      const fetchMock = stubApi(null)

      await renderAt(path)

      expect(where()).toBe('/login')
      expect(asked(fetchMock)).toEqual([])
    })

    it(`sends an employee-only account from ${path} to 내 정보 (regression)`, async () => {
      stubApi(EMPLOYEE_ONLY)

      await renderAt(path)

      expect(where()).toBe('/me')
    })
  }

  it('sends hr.manager from /projects/new to the project list', async () => {
    const fetchMock = stubApi(HR_MANAGER)

    await renderAt('/projects/new')

    expect(where()).toBe('/projects')
    expect(asked(fetchMock).filter((call) => !call.startsWith('GET '))).toEqual([])
  })

  it('sends hr.manager from /projects/1/edit to the detail of project 1', async () => {
    const fetchMock = stubApi(HR_MANAGER)

    await renderAt('/projects/1/edit')

    expect(where()).toBe('/projects/1')
    expect(asked(fetchMock).filter((call) => !call.startsWith('GET '))).toEqual([])
  })

  for (const user of [PROJECT_MANAGER, DUAL_MANAGER]) {
    it(`shows ${user.username} the registration form at /projects/new without asking for a project "new"`, async () => {
      const fetchMock = stubApi(user)

      await renderAt('/projects/new')

      expect(where()).toBe('/projects/new')
      expect(screen.getByRole('heading', { level: 1, name: '프로젝트 등록' })).toBeInTheDocument()
      expect(screen.getByRole('link', { name: '프로젝트' })).toHaveAttribute('aria-current', 'page')
      expect(asked(fetchMock)).not.toContain('GET /api/projects/new')
    })

    it(`shows ${user.username} the edit form of project 1 at /projects/1/edit`, async () => {
      const fetchMock = stubApi(user)

      await renderAt('/projects/1/edit')

      expect(where()).toBe('/projects/1/edit')
      expect(screen.getByRole('heading', { level: 1, name: '프로젝트 수정' })).toBeInTheDocument()
      expect(screen.getByRole('link', { name: '프로젝트' })).toHaveAttribute('aria-current', 'page')
      expect(asked(fetchMock)).toContain('GET /api/projects/1')
    })
  }

  it.each(['/projects/abc/edit', '/projects/0/edit'])('sends dual.manager from %s to / without a request', async (path) => {
    const fetchMock = stubApi(DUAL_MANAGER)

    await renderAt(path)

    expect(where()).toBe('/')
    expect(asked(fetchMock).filter((call) => call.includes('/api/projects'))).toEqual([])
  })
})
