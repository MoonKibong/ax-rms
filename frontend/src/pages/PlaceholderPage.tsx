import AppShell, { type NavKey } from '../components/AppShell'
import './pages.css'

// T#6: the place a business screen takes later (직원 → T#13, 프로젝트 → T#15). Only the title for now.
function PlaceholderPage({ current, title }: { current: NavKey; title: string }) {
  return (
    <AppShell current={current}>
      <h1 className="page__title">{title}</h1>
    </AppShell>
  )
}

export default PlaceholderPage
