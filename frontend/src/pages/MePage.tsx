import type { CurrentUser } from '../auth/AuthContext'
import AppShell from '../components/AppShell'
import './pages.css'

// T#6: 내 정보 (D24) until T#14 puts the read-only employee detail here.
function MePage({ user }: { user: CurrentUser }) {
  return (
    <AppShell current="me">
      <h1 className="page__title">내 정보</h1>
      <p className="page__name">{user.employeeName}</p>
    </AppShell>
  )
}

export default MePage
