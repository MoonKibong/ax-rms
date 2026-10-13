import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AuthContext, type AuthState } from '../auth/AuthContext'
import { HR_MANAGER, flush, never, reply } from '../test/api'
import LoginPage from './LoginPage'

// T#6 criterion 8: the login screen (BRIEF §6.1, D33).
function renderLogin() {
  const auth: AuthState = { status: 'ready', user: null, signIn: vi.fn(), logout: vi.fn(), retry: vi.fn() }
  render(
    <MemoryRouter initialEntries={['/login']}>
      <AuthContext.Provider value={auth}>
        <LoginPage />
      </AuthContext.Provider>
    </MemoryRouter>,
  )
  return auth
}

function fillIn(username: string, password: string) {
  fireEvent.change(screen.getByLabelText('계정'), { target: { value: username } })
  fireEvent.change(screen.getByLabelText('비밀번호'), { target: { value: password } })
}

const submit = () => fireEvent.click(screen.getByRole('button', { name: '로그인' }))

describe('LoginPage', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('connects the 계정 and 비밀번호 labels to their inputs', () => {
    renderLogin()

    expect(screen.getByLabelText('계정').tagName).toBe('INPUT')
    expect(screen.getByLabelText('비밀번호')).toHaveAttribute('type', 'password')
  })

  it('does not send an empty form and says what is missing under each input', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    renderLogin()

    submit()
    await flush()

    expect(fetchMock).not.toHaveBeenCalled()
    expect(screen.getByLabelText('계정')).toHaveAccessibleDescription('계정을 입력하세요.')
    expect(screen.getByLabelText('비밀번호')).toHaveAccessibleDescription('비밀번호를 입력하세요.')
  })

  it('shows the API message under the password input when the login is refused', async () => {
    const message = '계정 또는 비밀번호가 올바르지 않습니다.'
    vi.stubGlobal('fetch', vi.fn(() => reply(401, { code: 'AUTH_INVALID_CREDENTIALS', message })))
    const auth = renderLogin()

    fillIn('hr.manager', 'wrong-password')
    submit()
    await flush()

    const password = screen.getByLabelText('비밀번호')
    expect(password).toHaveAttribute('aria-invalid', 'true')
    expect(password).toHaveAccessibleDescription(message)
    expect(auth.signIn).not.toHaveBeenCalled()
  })

  it('says it could not log in when the request fails', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new TypeError('Failed to fetch'))))
    renderLogin()

    fillIn('hr.manager', 'HrManager!1')
    submit()
    await flush()

    expect(screen.getByLabelText('비밀번호')).toHaveAccessibleDescription(
      '로그인하지 못했습니다. 잠시 후 다시 시도하세요.',
    )
  })

  it('sends one request while logging in, however often it is submitted', async () => {
    const fetchMock = vi.fn(never)
    vi.stubGlobal('fetch', fetchMock)
    renderLogin()

    fillIn('hr.manager', 'HrManager!1')
    submit()
    await flush()
    expect(screen.getByRole('button', { name: '로그인' })).toHaveAttribute('aria-busy', 'true')

    submit()
    fireEvent.submit(screen.getByLabelText('비밀번호'))
    await flush()

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('signs in with the user the API returns', async () => {
    const fetchMock = vi.fn(() => reply(200, HR_MANAGER))
    vi.stubGlobal('fetch', fetchMock)
    const auth = renderLogin()

    fillIn('hr.manager', 'HrManager!1')
    submit()
    await flush()

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/auth/login',
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ username: 'hr.manager', password: 'HrManager!1' }) }),
    )
    expect(auth.signIn).toHaveBeenCalledWith(HR_MANAGER)
  })
})
