import type { ReactNode } from 'react'
import './AppShell.css'

export type NavKey = 'dashboard' | 'employees' | 'projects'

// BRIEF §4 navigation items. Routing and role-based items come with T#6.
const NAV_ITEMS: Array<{ key: NavKey; label: string; href: string }> = [
  { key: 'dashboard', label: '대시보드', href: '/' },
  { key: 'employees', label: '직원', href: '/employees' },
  { key: 'projects', label: '프로젝트', href: '/projects' },
]

type AppShellProps = {
  current: NavKey
  children: ReactNode
}

function AppShell({ current, children }: AppShellProps) {
  return (
    <div className="shell">
      <header className="shell__header">
        <span className="shell__brand">Workforce Planner</span>
      </header>
      <nav className="shell__nav" aria-label="주 메뉴">
        {NAV_ITEMS.map((item) => (
          <a
            key={item.key}
            className="shell__link"
            href={item.href}
            aria-current={item.key === current ? 'page' : undefined}
          >
            {item.label}
          </a>
        ))}
      </nav>
      <main className="shell__main">
        <div className="shell__content">{children}</div>
      </main>
    </div>
  )
}

export default AppShell
