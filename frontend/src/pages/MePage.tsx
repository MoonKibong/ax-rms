import { useAuth } from '../auth/AuthContext'
import AppShell from '../components/AppShell'
import EmployeeDetailLoader from './EmployeeDetail'
import './pages.css'

// 내 정보 (D24, T#38): the logged-in account's own employee detail from GET /api/me/employee, read-only for every role.
// The T#6 title stays; the employee's name is the heading below it (the login's name until the detail has come).
function MePage() {
  const { user } = useAuth()
  return (
    <AppShell current="me">
      <div className="me-page">
        <h1 className="page__title">내 정보</h1>
        <EmployeeDetailLoader url="/api/me/employee" headingLevel={2} pendingName={user?.employeeName} />
      </div>
    </AppShell>
  )
}

export default MePage
