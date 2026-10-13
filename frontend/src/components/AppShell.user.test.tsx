import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { AuthContext, type CurrentUser } from '../auth/AuthContext'
import { DUAL_MANAGER, EMPLOYEE_ONLY, HR_MANAGER } from '../test/api'
import AppShell, { type NavKey } from './AppShell'

// T#6 criterion 10: the user area and the menu by role (BRIEF §4, D25). T#4's AppShell.test.tsx stays as it is.
function renderShell(user: CurrentUser, current: NavKey) {
  const logout = vi.fn(() => Promise.resolve(true))
  render(
    <AuthContext.Provider value={{ status: 'ready', user, signIn: vi.fn(), logout, retry: vi.fn() }}>
      <AppShell current={current}>
        <p>본문</p>
      </AppShell>
    </AuthContext.Provider>,
  )
  return logout
}

const links = () => within(screen.getByRole('navigation')).getAllByRole('link')

describe('AppShell with a logged-in user', () => {
  it('shows a manager the three items, the employee name, and 로그아웃', () => {
    const logout = renderShell(HR_MANAGER, 'dashboard')

    expect(links().map((link) => link.textContent)).toEqual(['대시보드', '직원', '프로젝트'])
    expect(within(screen.getByRole('banner')).getByText('이수민')).toBeInTheDocument()

    fireEvent.click(within(screen.getByRole('banner')).getByRole('button', { name: '로그아웃' }))
    expect(logout).toHaveBeenCalledTimes(1)
  })

  it('shows an account with both manager roles the same three items', () => {
    renderShell(DUAL_MANAGER, 'projects')

    expect(within(screen.getByRole('banner')).queryByText('오승현')).toBeInTheDocument()
    expect(within(screen.getByRole('banner')).queryByRole('button', { name: '로그아웃' })).toBeInTheDocument()
    expect(links().map((link) => link.textContent)).toEqual(['대시보드', '직원', '프로젝트'])
    expect(links().map((link) => link.getAttribute('aria-current'))).toEqual([null, null, 'page'])
  })

  it('shows an employee-only account just 내 정보', () => {
    renderShell(EMPLOYEE_ONLY, 'me')

    expect(links().map((link) => link.textContent)).toEqual(['내 정보'])
    expect(links().map((link) => link.getAttribute('href'))).toEqual(['/me'])
    expect(links().map((link) => link.getAttribute('aria-current'))).toEqual(['page'])
  })
})
