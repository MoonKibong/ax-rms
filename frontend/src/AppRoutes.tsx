import type { ReactNode } from 'react'
import { Navigate, Route, Routes, useLocation, useParams } from 'react-router'
import App from './App'
import { homePath, isManager, useAuth, type CurrentUser } from './auth/AuthContext'
import { isHrManager, isProjectManager } from './auth/roles'
import StateMessage from './components/StateMessage'
import DashboardPage from './pages/DashboardPage'
import EmployeeDetailPage from './pages/EmployeeDetailPage'
import EmployeeFormPage from './pages/EmployeeFormPage'
import EmployeeListPage from './pages/EmployeeListPage'
import LoginPage from './pages/LoginPage'
import MePage from './pages/MePage'
import { ProjectAssignRoute } from './pages/ProjectAssignPage'
import { ProjectDetailRoute } from './pages/ProjectDetailPage'
import ProjectFormPage from './pages/ProjectFormPage'
import ProjectListPage from './pages/ProjectListPage'
import './AppRoutes.css'

// T#55: a logged-out visitor is sent to /login with the address they were on (path, query and hash), and logging in
// leads back there. The state is the router's own, but it is checked again: only a path inside this app is followed.
function ToLogin() {
  const { pathname, search, hash } = useLocation()
  return <Navigate to="/login" replace state={{ from: pathname + search + hash }} />
}

function returnPath(state: unknown): string | null {
  const from = (state as { from?: unknown } | null)?.from
  if (typeof from !== 'string' || !from.startsWith('/') || from.startsWith('//') || from.startsWith('/\\')) {
    return null
  }
  return new URL(from, 'http://localhost').pathname === '/login' ? null : from
}

function LoginRoute({ user }: { user: CurrentUser | null }) {
  const { state } = useLocation()
  if (!user) {
    return <LoginPage />
  }
  return <Navigate to={returnPath(state) ?? homePath(user)} replace />
}

// T#6 contract "화면과 라우팅" (D16, D25). Nothing protected is drawn until GET /api/auth/me has answered.
function ManagerOnly({ user, children }: { user: CurrentUser | null; children: ReactNode }) {
  if (!user) {
    return <ToLogin />
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

// T#34 (D9): the project forms are the project manager's. Inside ManagerOnly, so this sees a manager: an HR manager goes
// back to where the form would have led (the list, or that project's detail).
function ProjectManagerOnly({ user, fallback, children }: { user: CurrentUser | null; fallback: string; children: ReactNode }) {
  if (!isProjectManager(user)) {
    return <Navigate to={fallback} replace />
  }
  return children
}

// /projects/:id/edit: like the detail (T#16), only a positive whole number is a project address; anything else goes
// where "*" goes, without a request.
function EditProjectRoute({ user }: { user: CurrentUser | null }) {
  const { id = '' } = useParams()
  if (!/^[1-9][0-9]*$/.test(id)) {
    return <Navigate to="/" replace />
  }
  return (
    <ProjectManagerOnly user={user} fallback={`/projects/${id}`}>
      <ProjectFormPage mode="edit" />
    </ProjectManagerOnly>
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
      <Route path="/login" element={<LoginRoute user={user} />} />
      <Route
        path="/"
        element={
          <ManagerOnly user={user}>
            <DashboardPage />
          </ManagerOnly>
        }
      />
      {/* T#18: the reference screen of T#4 (BRIEF §6.0) gave `/` to the dashboard; its checks open it here. */}
      <Route
        path="/design-reference"
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
        path="/projects/new"
        element={
          <ManagerOnly user={user}>
            <ProjectManagerOnly user={user} fallback="/projects">
              <ProjectFormPage mode="new" />
            </ProjectManagerOnly>
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
        path="/projects/:id/edit"
        element={
          <ManagerOnly user={user}>
            <EditProjectRoute user={user} />
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
      <Route path="/me" element={user ? <MePage /> : <ToLogin />} />
      <Route path="*" element={<Navigate to={user ? homePath(user) : '/login'} replace />} />
    </Routes>
  )
}

export default AppRoutes
