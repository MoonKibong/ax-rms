import type { FullConfig } from '@playwright/test'

// T#6: the backend seeds the demo data after Tomcat has started, so /api/health answering (scripts/e2e-servers.sh)
// does not mean the demo accounts exist yet. Wait at most 30 seconds until a demo login works.
export default async function globalSetup(config: FullConfig): Promise<void> {
  const baseURL = config.projects[0]?.use.baseURL ?? 'http://localhost:14173'
  const deadline = Date.now() + 30_000
  let last = 'no answer'
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${baseURL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'employee.demo', password: 'Employee!1' }),
        signal: AbortSignal.timeout(Math.max(1, deadline - Date.now())),
      })
      if (response.ok) {
        return
      }
      last = `status ${response.status}`
    } catch (error) {
      last = String(error)
    }
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  throw new Error(
    `global-setup: employee.demo 로그인이 30초 안에 성공하지 않았습니다 (마지막 응답: ${last}). ` +
      '시드가 끝나지 않았거나 로그인 API가 없습니다.',
  )
}
