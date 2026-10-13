import { useRef, useState, type FormEvent } from 'react'
import { useAuth, type CurrentUser } from '../auth/AuthContext'
import Button from '../components/Button'
import TextField from '../components/TextField'
import './LoginPage.css'

// BRIEF §6.1 (D16). Errors sit under the input they belong to (D33); a refused login shows the API's message.
const FAILED = '로그인하지 못했습니다. 잠시 후 다시 시도하세요.'

type Errors = { username?: string; password?: string }

function LoginPage() {
  const { signIn } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<Errors>({})
  const [submitting, setSubmitting] = useState(false)
  const inFlight = useRef(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (inFlight.current) {
      return
    }
    const missing: Errors = {
      username: username.trim() ? undefined : '계정을 입력하세요.',
      password: password.trim() ? undefined : '비밀번호를 입력하세요.',
    }
    setErrors(missing)
    if (missing.username || missing.password) {
      return
    }

    inFlight.current = true
    setSubmitting(true)
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })
      if (response.ok) {
        signIn((await response.json()) as CurrentUser)
        return
      }
      // The body is read for every answer (an unread body keeps the request open); only a 4xx message is shown.
      const body = await response.json().catch(() => null)
      const message = response.status < 500 && typeof body?.message === 'string' ? body.message : FAILED
      setErrors({ password: message })
    } catch {
      setErrors({ password: FAILED })
    } finally {
      inFlight.current = false
      setSubmitting(false)
    }
  }

  return (
    <main className="login">
      <div className="login__card" data-testid="login-card">
        <h1 className="login__brand">Workforce Planner</h1>
        <form className="login__form" noValidate onSubmit={handleSubmit}>
          <TextField
            label="계정"
            name="username"
            autoComplete="username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            error={errors.username}
          />
          <TextField
            label="비밀번호"
            name="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            error={errors.password}
          />
          <Button type="submit" className="login__submit" loading={submitting}>
            로그인
          </Button>
        </form>
      </div>
    </main>
  )
}

export default LoginPage
