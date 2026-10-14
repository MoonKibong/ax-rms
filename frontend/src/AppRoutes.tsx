import type { ReactNode } from 'react'
import { Navigate, Route, Routes, useParams } from 'react-router'
import App from './App'
import { homePath, isManager, useAuth, type CurrentUser } from './auth/AuthContext'
import { isHrManager } from './auth/roles'
import StateMessage from './components/StateMessage'
import EmployeeDetailPage from './pages/EmployeeDetailPage'
import EmployeeFormPage from './pages/EmployeeFormPage'
import EmployeeListPage from './pages/EmployeeListPage'
import LoginPage from './pages/LoginPage'
import MePage from './pages/MePage'
import { ProjectAssignRoute } from './pages/ProjectAssignPage'
import { ProjectDetailRoute } from './pages/ProjectDetailPage'
import ProjectListPage from './pages/ProjectListPage'
import './AppRoutes.css'

// T#6 contract "화면과 라우팅" (D16, D25). Nothing protected is drawn until GET /api/auth/me has answered.
function ManagerOnly({ user, children }: { user: CurrentUser | null; children: ReactNode }) {
  if (!user) {
    return <Navigate to="/login" replace />
  }
  if (!isManager(user)) {
    return <Navigate to="/me" replace />
  }
  return children
}

// T#39 (D9): the employee forms are the HR manager's. Inside ManagerOnly, so this sees a manager: a project manager
// goes back to where the form would have led (the list, or that employee's detail).
function HrManagerOnly({ user, fallback, children }: { user: CurrentUser | null; fallback: string; children: ReactNode }) {
  if (!isHrManager(user)) {
    return <Navigate to={fallback} replace />
  }
  return children
}

function EditEmployeeRoute({ user }: { user: CurrentUser | null }) {
  const { id = '' } = useParams()
  return (
    <HrManagerOnly user={user} fallback={`/employees/${encodeURIComponent(id)}`}>
      <EmployeeFormPage mode="edit" />
    </HrManagerOnly>
  )
}

function AppRoutes() {
  const { status, user, retry } = useAuth()

  if (status === 'loading') {
    return (
      <div className="auth-status" aria-busy="true">
        <p className="auth-status__text">불러오는 중…</p>
      </div>
    )
  }
  if (status === 'error') {
    return (
      <div className="auth-status">
        <StateMessage kind="error" onRetry={retry} />
      </div>
    )
  }

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to={homePath(user)} replace /> : <LoginPage />} />
      <Route
        path="/"
        element={
          <ManagerOnly user={user}>
            <App />
          </ManagerOnly>
        }
      />
      <Route
        path="/employees"
        element={
          <ManagerOnly user={user}>
            <EmployeeListPage />
          </ManagerOnly>
        }
      />
      <Route
        path="/employees/new"
        element={
          <ManagerOnly user={user}>
            <HrManagerOnly user={user} fallback="/employees">
              <EmployeeFormPage mode="new" />
            </HrManagerOnly>
          </ManagerOnly>
        }
      />
      <Route
        path="/employees/:id"
        element={
          <ManagerOnly user={user}>
            <EmployeeDetailPage />
          </ManagerOnly>
        }
      />
      <Route
        path="/employees/:id/edit"
        element={
          <ManagerOnly user={user}>
            <EditEmployeeRoute user={user} />
          </ManagerOnly>
        }
      />
      <Route
        path="/projects"
        element={
          <ManagerOnly user={user}>
            <ProjectListPage />
          </ManagerOnly>
        }
      />
      <Route
        path="/projects/:id"
        element={
          <ManagerOnly user={user}>
            <ProjectDetailRoute />
          </ManagerOnly>
        }
      />
      <Route
        path="/projects/:id/assign"
        element={
          <ManagerOnly user={user}>
            <ProjectAssignRoute />
          </ManagerOnly>
        }
      />
      <Route path="/me" element={user ? <MePage /> : <Navigate to="/login" replace />} />
      <Route path="*" element={<Navigate to={user ? homePath(user) : '/login'} replace />} />
    </Routes>
  )
}

export default AppRoutes
