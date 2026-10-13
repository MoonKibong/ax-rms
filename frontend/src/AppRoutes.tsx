import type { ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router'
import App from './App'
import { homePath, isManager, useAuth, type CurrentUser } from './auth/AuthContext'
import StateMessage from './components/StateMessage'
import LoginPage from './pages/LoginPage'
import MePage from './pages/MePage'
import PlaceholderPage from './pages/PlaceholderPage'
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
            <PlaceholderPage current="employees" title="직원" />
          </ManagerOnly>
        }
      />
      <Route
        path="/projects"
        element={
          <ManagerOnly user={user}>
            <PlaceholderPage current="projects" title="프로젝트" />
          </ManagerOnly>
        }
      />
      <Route path="/me" element={user ? <MePage user={user} /> : <Navigate to="/login" replace />} />
      <Route path="*" element={<Navigate to={user ? homePath(user) : '/login'} replace />} />
    </Routes>
  )
}

export default AppRoutes
