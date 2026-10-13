import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import AppRoutes from './AppRoutes'
import { AuthProvider } from './auth/AuthContext'
import { EMPLOYEE_ONLY, HR_MANAGER, flush, never, reply } from './test/api'

// T#6 criterion 7: the login check and route protection (contract "화면과 라우팅").
function Where() {
  return <output data-testid="where">{useLocation().pathname}</output>
}

function stubApi(me: () => Promise<Response>) {
  const fetchMock = vi.fn((input: RequestInfo | URL) => {
    const url = String(input)
    if (url === '/api/auth/me') return me()
    if (url === '/api/health') return reply(200, { status: 'UP' })
    return reply(404, {})
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function meCalls(fetchMock: ReturnType<typeof stubApi>) {
  return fetchMock.mock.calls.filter(([input]) => String(input) === '/api/auth/me').length
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

describe('AppRoutes', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('shows the login form to a logged-out visitor at /employees', async () => {
    stubApi(() => reply(401, { code: 'AUTH_REQUIRED', message: '로그인이 필요합니다.' }))

    await renderAt('/employees')

    expect(screen.queryByLabelText('계정')).toBeInTheDocument()
    expect(where()).toBe('/login')
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
  })

  it('sends an employee-only account from /employees to 내 정보', async () => {
    stubApi(() => reply(200, EMPLOYEE_ONLY))

    await renderAt('/employees')

    expect(where()).toBe('/me')
    expect(screen.queryByRole('heading', { name: '내 정보' })).toBeInTheDocument()
    expect(within(screen.getByRole('main')).queryByText('한지우')).toBeInTheDocument()
  })

  it('sends a manager from /login to /', async () => {
    stubApi(() => reply(200, HR_MANAGER))

    await renderAt('/login')

    expect(where()).toBe('/')
    expect(screen.queryByRole('heading', { name: '디자인 참조' })).toBeInTheDocument()
  })

  it('shows only 불러오는 중… while the login check is pending', async () => {
    stubApi(never)

    await renderAt('/employees')

    expect(screen.queryByText('불러오는 중…')).toBeInTheDocument()
    expect(screen.queryByLabelText('계정')).not.toBeInTheDocument()
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
  })

  it('offers 다시 시도 when the login check fails and asks again', async () => {
    const answers = [reply(500, {}), reply(401, { code: 'AUTH_REQUIRED', message: '로그인이 필요합니다.' })]
    const fetchMock = stubApi(() => answers.shift() ?? never())

    await renderAt('/employees')
    expect(screen.queryByText('데이터를 불러오지 못했습니다')).toBeInTheDocument()
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }))
    await flush()

    expect(meCalls(fetchMock)).toBe(2)
    expect(screen.queryByLabelText('계정')).toBeInTheDocument()
  })
})
