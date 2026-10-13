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

function stubApi(me: () => Promise<Response>, logout: () => Promise<Response> = () => reply(204, null)) {
  const fetchMock = vi.fn((input: RequestInfo | URL) => {
    const url = String(input)
    if (url === '/api/auth/me') return me()
    if (url === '/api/auth/logout') return logout()
    if (url === '/api/health') return reply(200, { status: 'UP' })
    return reply(404, {})
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function calls(fetchMock: ReturnType<typeof stubApi>, url: string) {
  return fetchMock.mock.calls.filter(([input]) => String(input) === url).length
}

const LOGOUT_FAILED = '로그아웃하지 못했습니다. 잠시 후 다시 시도하세요.'
const clickLogout = () =>
  fireEvent.click(within(screen.getByRole('banner')).getByRole('button', { name: '로그아웃' }))

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

    expect(calls(fetchMock, '/api/auth/me')).toBe(2)
    expect(screen.queryByLabelText('계정')).toBeInTheDocument()
  })

  // Review 1 (REVISE) finding 1: logout ends only when the server says the session is gone.
  it('keeps the account logged in and says so when logout fails, and logs out on the next try', async () => {
    const answers = [
      () => reply(500, {}),
      () => Promise.reject(new TypeError('Failed to fetch')),
      () => reply(204, null),
    ]
    const fetchMock = stubApi(
      () => reply(200, HR_MANAGER),
      () => (answers.shift() ?? never)(),
    )
    await renderAt('/')

    clickLogout()
    await flush()
    expect(where(), 'after a 500').toBe('/')
    expect(within(screen.getByRole('banner')).queryByText('이수민')).toBeInTheDocument()
    expect(screen.getByText(LOGOUT_FAILED).closest('[role="alert"]')).not.toBeNull()

    clickLogout()
    await flush()
    expect(where(), 'after a network error').toBe('/')
    expect(screen.queryByText(LOGOUT_FAILED)).toBeInTheDocument()

    clickLogout()
    await flush()
    expect(calls(fetchMock, '/api/auth/logout')).toBe(3)
    expect(where()).toBe('/login')
    expect(screen.queryByLabelText('계정')).toBeInTheDocument()
  })

  it('treats a 401 logout as already logged out', async () => {
    stubApi(
      () => reply(200, HR_MANAGER),
      () => reply(401, { code: 'AUTH_REQUIRED', message: '로그인이 필요합니다.' }),
    )
    await renderAt('/')

    clickLogout()
    await flush()

    expect(where()).toBe('/login')
  })
})
