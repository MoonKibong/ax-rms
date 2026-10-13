import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

// T#6: who is logged in. The server session (cookie) is the source of truth; the app asks GET /api/auth/me
// when it opens and keeps the answer here.
export type Role = 'HR_MANAGER' | 'PROJECT_MANAGER' | 'EMPLOYEE'

export type CurrentUser = {
  username: string
  employeeId: number
  employeeName: string
  roles: Role[]
}

export type AuthState = {
  status: 'loading' | 'error' | 'ready'
  user: CurrentUser | null
  signIn: (user: CurrentUser) => void
  // Resolves true once the server session has ended (or there was none); false if it may still be alive.
  logout: () => Promise<boolean>
  retry: () => void
}

export const AuthContext = createContext<AuthState | null>(null)

// D25: an account with either manager role sees every screen; an account with only EMPLOYEE sees its own detail.
export function isManager(user: CurrentUser): boolean {
  return user.roles.includes('HR_MANAGER') || user.roles.includes('PROJECT_MANAGER')
}

export function homePath(user: CurrentUser): string {
  return isManager(user) ? '/' : '/me'
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthState['status']>('loading')
  const [user, setUser] = useState<CurrentUser | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    fetch('/api/auth/me')
      .then(async (response) => {
        if (response.ok) {
          const current = (await response.json()) as CurrentUser
          if (!cancelled) {
            setUser(current)
            setStatus('ready')
          }
        } else {
          // Read the error body too: an unread body keeps the request open in the browser.
          await response.text().catch(() => '')
          if (!cancelled) {
            setUser(null)
            setStatus(response.status === 401 ? 'ready' : 'error')
          }
        }
      })
      .catch(() => {
        if (!cancelled) {
          setStatus('error')
        }
      })
    return () => {
      cancelled = true
    }
  }, [attempt])

  const signIn = useCallback((current: CurrentUser) => {
    setUser(current)
    setStatus('ready')
  }, [])

  // The screen logs out only when the server says the session is gone: 2xx (ended now) or 401 (already gone).
  // A network error or any other answer keeps the account logged in, so the caller can say so and try again.
  const logout = useCallback(async () => {
    try {
      const response = await fetch('/api/auth/logout', { method: 'POST' })
      await response.text().catch(() => '')
      if (response.ok || response.status === 401) {
        setUser(null)
        return true
      }
      return false
    } catch {
      return false
    }
  }, [])

  const retry = useCallback(() => {
    setStatus('loading')
    setAttempt((count) => count + 1)
  }, [])

  const value = useMemo(() => ({ status, user, signIn, logout, retry }), [status, user, signIn, logout, retry])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthState {
  const auth = useContext(AuthContext)
  if (!auth) {
    throw new Error('useAuth must be used inside AuthProvider')
  }
  return auth
}
