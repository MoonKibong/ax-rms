import { fireEvent, render, screen, within } from '@testing-library/react'
import { useEffect } from 'react'
import { MemoryRouter, useLocation, type Location } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { apiFetch } from './api/client'
import AppRoutes from './AppRoutes'
import { AuthProvider, type CurrentUser } from './auth/AuthContext'
import { EMPLOYEE_ONLY, HR_MANAGER, flush, reply } from './test/api'
import { deferred } from './test/employees'

// T#55 criteria 1–5 and 8–9: the real AuthProvider and AppRoutes in a MemoryRouter, with only the global fetch replaced by
// a small server that has a session (`alive`) which a test can end.
const EXPIRED = { code: 'AUTH_REQUIRED', message: '로그인이 필요합니다.' }
const DEEP = '/projects/5?tab=x#y'

type Server = {
  alive: boolean
  account: CurrentUser
  // How a business address answers; the default is 404 so that a returned-to screen has something to show.
  business: (url: string, init: RequestInit | undefined) => Promise<Response>
  calls: Array<{ url: string; method: string }>
}

function startServer(overrides: Partial<Server> = {}): Server {
  const server: Server = {
    alive: true,
    account: HR_MANAGER,
    business: () => reply(404, { code: 'NOT_FOUND', message: '없습니다.' }),
    calls: [],
    ...overrides,
  }
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      server.calls.push({ url, method: init?.method ?? 'GET' })
      if (url === '/api/auth/me') return server.alive ? reply(200, server.account) : reply(401, EXPIRED)
      if (url === '/api/auth/login') {
        server.alive = true
        return reply(200, server.account)
      }
      if (url === '/api/auth/logout') return reply(401, EXPIRED)
      return server.business(url, init)
    }),
  )
  return server
}

// A business address whose first answer ends the session with a 401, as the server does when the session times out.
function expiresOn(server: Server, address: string) {
  let first = true
  server.business = (url) => {
    if (url === address && first) {
      first = false
      server.alive = false
      return reply(401, EXPIRED)
    }
    return reply(404, { code: 'NOT_FOUND', message: '없습니다.' })
  }
}

// Every distinct place the router was at, in order: a second trip to /login would show up twice.
const visited: string[] = []

function Where() {
  const location = useLocation()
  const here = location.pathname + location.search + location.hash
  useEffect(() => {
    visited.push(here)
  }, [here, location.key])
  return <output data-testid="where">{here}</output>
}

// Sends the requests a screen would send, so a test can overlap them.
function Probe({ requests }: { requests: Array<() => Promise<Response>> }) {
  return (
    <button type="button" onClick={() => requests.forEach((request) => void request().catch(() => undefined))}>
      probe
    </button>
  )
}

async function renderAt(entry: string | Partial<Location>, requests: Array<() => Promise<Response>> = []) {
  visited.length = 0
  render(
    <MemoryRouter initialEntries={[entry]}>
      <AuthProvider>
        <AppRoutes />
        <Where />
        <Probe requests={requests} />
      </AuthProvider>
    </MemoryRouter>,
  )
  await flush()
}

const where = () => screen.getByTestId('where').textContent
const bannerName = (name: string) => screen.queryByRole('banner')?.textContent?.includes(name) ?? false

async function logIn() {
  fireEvent.change(screen.getByLabelText('계정'), { target: { value: 'hr.manager' } })
  fireEvent.change(screen.getByLabelText('비밀번호'), { target: { value: 'HrManager!1' } })
  fireEvent.click(screen.getByRole('button', { name: '로그인' }))
  await flush()
}

const probe = () => fireEvent.click(screen.getByRole('button', { name: 'probe' }))

describe('a session that ends while the app is open (T#55)', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  // Criterion 1.
  it('sends the user to /login when a read answers 401, with no name in the header and no retry message', async () => {
    const server = startServer()
    expiresOn(server, '/api/projects/5')

    await renderAt(DEEP)

    expect(where()).toBe('/login')
    expect(screen.getByLabelText('계정')).toBeInTheDocument()
    expect(screen.queryByRole('banner')).not.toBeInTheDocument()
    expect(screen.queryByText(HR_MANAGER.employeeName)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '다시 시도' })).not.toBeInTheDocument()
  })

  // Criterion 3.
  it('brings the user back to the address with its query and hash after logging in again', async () => {
    const server = startServer()
    expiresOn(server, '/api/projects/5')
    await renderAt(DEEP)
    expect(where()).toBe('/login')

    await logIn()

    expect(where()).toBe(DEEP)
    expect(bannerName(HR_MANAGER.employeeName)).toBe(true)
  })

  it('brings a logged-out visitor who opened a deep link back to it after logging in', async () => {
    startServer({ alive: false })

    await renderAt(DEEP)
    expect(where()).toBe('/login')
    await logIn()

    expect(where()).toBe(DEEP)
  })

  // Criterion 2.
  it('treats a 401 of a write like a 401 of a read, and sends the write only once', async () => {
    const server = startServer()
    server.business = (url, init) => {
      if (url === '/api/departments') return reply(200, [{ id: 1, name: '개발팀' }])
      if (init?.method === 'POST') {
        server.alive = false
        return reply(401, EXPIRED)
      }
      return reply(404, {})
    }
    await renderAt('/employees/new')
    fireEvent.change(screen.getByRole('textbox', { name: '이름' }), { target: { value: '김하나' } })
    fireEvent.change(screen.getByRole('combobox', { name: '부서' }), { target: { value: '1' } })
    fireEvent.change(screen.getByRole('textbox', { name: '직무' }), { target: { value: '개발자' } })
    fireEvent.change(screen.getByRole('spinbutton', { name: '경력(년)' }), { target: { value: '3' } })

    fireEvent.click(screen.getByRole('button', { name: '저장' }))
    await flush()

    expect(where()).toBe('/login')
    expect(server.calls.filter((call) => call.method === 'POST')).toHaveLength(1)

    await logIn()
    expect(where()).toBe('/employees/new')
    expect(server.calls.filter((call) => call.method === 'POST' && call.url === '/api/employees')).toHaveLength(1)
  })

  // Criterion 4.
  it.each(['https://evil.example/x', '//evil.example/x', '/\\evil.example', '/login', '', 42])(
    'ignores %j as a place to return to and goes home',
    async (from) => {
      startServer({ alive: false })

      await renderAt({ pathname: '/login', state: { from } })
      await logIn()

      expect(where()).toBe('/')
    },
  )

  it('applies the role guard to the place it returns to', async () => {
    startServer({ alive: false, account: EMPLOYEE_ONLY })

    await renderAt('/projects/5')
    expect(where()).toBe('/login')
    await logIn()

    expect(where()).toBe('/me')
  })

  it('applies the role of the next account: a project-manager-only page goes to its fallback for an HR manager', async () => {
    startServer({ alive: false, account: HR_MANAGER })

    await renderAt('/projects/new')
    await logIn()

    expect(where()).toBe('/projects')
  })

  // Criterion 5 (regression: these answers meant what they mean today).
  it('shows a refused login under the password, not as an expired session', async () => {
    startServer({ alive: false })
    await renderAt('/login')
    vi.stubGlobal(
      'fetch',
      vi.fn(() => reply(401, { code: 'AUTH_INVALID_CREDENTIALS', message: '계정 또는 비밀번호가 올바르지 않습니다.' })),
    )

    await logIn()

    expect(where()).toBe('/login')
    expect(screen.getByText('계정 또는 비밀번호가 올바르지 않습니다.')).toBeInTheDocument()
  })

  it('logs out on a 401 of the logout request, as before', async () => {
    startServer()
    await renderAt('/')
    expect(where()).toBe('/')

    fireEvent.click(within(screen.getByRole('banner')).getByRole('button', { name: '로그아웃' }))
    await flush()

    expect(where()).toBe('/login')
  })

  // Criterion 8.
  it('goes to /login once when several requests answer 401 together, remembering where the first one was', async () => {
    const server = startServer()
    let asked = -1 // -1: not yet; then the three overlapping requests are the only ones answered 401
    server.business = () => {
      if (asked < 0 || asked >= 3) return reply(404, {})
      asked += 1
      server.alive = false
      return reply(401, EXPIRED)
    }
    await renderAt('/employees/new', [() => apiFetch('/api/a'), () => apiFetch('/api/b'), () => apiFetch('/api/c')])
    asked = 0
    visited.length = 0

    probe()
    await flush()

    expect(visited.filter((place) => place === '/login')).toHaveLength(1)
    await logIn()
    expect(where()).toBe('/employees/new')
  })

  // Criterion 9.
  it('keeps the new session when an answer of the old one arrives late', async () => {
    const late = deferred()
    const server = startServer()
    server.business = (url) => (url === '/api/late' ? late.promise : url === '/api/now' ? reply(401, EXPIRED) : reply(404, {}))
    await renderAt('/employees/new', [() => apiFetch('/api/late')])
    probe()
    expect(late.isReleased()).toBe(false)
    server.alive = false
    await apiFetch('/api/now')
    await flush()
    expect(where()).toBe('/login')
    await logIn()
    expect(where()).toBe('/employees/new')

    late.release(await reply(401, EXPIRED))
    await flush()

    expect(where()).toBe('/employees/new')
    expect(bannerName(HR_MANAGER.employeeName)).toBe(true)
  })
})

