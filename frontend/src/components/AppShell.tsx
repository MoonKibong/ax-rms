import { useContext, useRef, useState, type ReactNode } from 'react'
import { Link, useInRouterContext } from 'react-router'
import { AuthContext, isManager } from '../auth/AuthContext'
import Button from './Button'
import { WarningIcon } from './icons'
import './AppShell.css'

export type NavKey = 'dashboard' | 'employees' | 'projects' | 'me'

type NavItem = { key: NavKey; label: string; href: string }

// BRIEF §4 navigation items by role (D25): an account with a manager role sees the three business items; an
// account with only the employee role sees 내 정보 alone. Without a logged-in user (T#4's reference screen and its
// tests) the shell shows the three items and no user area.
const MANAGER_ITEMS: NavItem[] = [
  { key: 'dashboard', label: '대시보드', href: '/' },
  { key: 'employees', label: '직원', href: '/employees' },
  { key: 'projects', label: '프로젝트', href: '/projects' },
]
const EMPLOYEE_ITEMS: NavItem[] = [{ key: 'me', label: '내 정보', href: '/me' }]

// BRIEF §3.1: a failed action is explained on the screen, not on the button.
const LOGOUT_FAILED = '로그아웃하지 못했습니다. 잠시 후 다시 시도하세요.'

type AppShellProps = {
  current: NavKey
  children: ReactNode
}

function AppShell({ current, children }: AppShellProps) {
  const auth = useContext(AuthContext)
  const user = auth?.user ?? null
  const inRouter = useInRouterContext()
  const items = user && !isManager(user) ? EMPLOYEE_ITEMS : MANAGER_ITEMS
  const [logoutState, setLogoutState] = useState<'idle' | 'pending' | 'failed'>('idle')
  const logoutInFlight = useRef(false)

  // One logout request at a time. On success the routes leave this screen; on failure the account stays
  // logged in, the message says so, and 로그아웃 can be pressed again.
  async function handleLogout() {
    if (!auth || logoutInFlight.current) {
      return
    }
    logoutInFlight.current = true
    setLogoutState('pending')
    const loggedOut = await auth.logout()
    logoutInFlight.current = false
    setLogoutState(loggedOut ? 'idle' : 'failed')
  }

  return (
    <div className="shell">
      <header className="shell__header">
        <span className="shell__brand">Workforce Planner</span>
        {user ? (
          <div className="shell__user">
            <span className="shell__user-name">{user.employeeName}</span>
            <Button variant="secondary" loading={logoutState === 'pending'} onClick={handleLogout}>
              로그아웃
            </Button>
          </div>
        ) : null}
      </header>
      <nav className="shell__nav" aria-label="주 메뉴">
        {items.map((item) => {
          const ariaCurrent = item.key === current ? 'page' : undefined
          return inRouter ? (
            <Link key={item.key} className="shell__link" to={item.href} aria-current={ariaCurrent}>
              {item.label}
            </Link>
          ) : (
            <a key={item.key} className="shell__link" href={item.href} aria-current={ariaCurrent}>
              {item.label}
            </a>
          )
        })}
      </nav>
      <main className="shell__main">
        <div className="shell__content">
          {logoutState === 'failed' ? (
            <p className="shell__alert" role="alert">
              <WarningIcon size={16} />
              {LOGOUT_FAILED}
            </p>
          ) : null}
          {children}
        </div>
      </main>
    </div>
  )
}

export default AppShell
