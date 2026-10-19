// T#55 (ENGINEERING.md "API 클라이언트" 1): the one place that sees a 401 of a business request. apiFetch asks the global
// fetch exactly what it was asked (same arguments, never repeated) and gives the response back as it is; the only thing it
// adds is telling the AuthProvider that the session has ended. The account endpoints (/api/auth/…) are not business
// requests: a 401 there means a refused login or no session yet, so they never count.
let onSessionExpired: (() => void) | null = null

// Each login and each expiry starts a new session. A request remembers the one it began in, so the late 401 of an old
// session cannot end the new one, and several 401s of the same session end it once.
let session = 0

export function setSessionExpiredHandler(handler: (() => void) | null): void {
  onSessionExpired = handler
}

export function startNewSession(): void {
  session += 1
}

function isAccountEndpoint(input: RequestInfo | URL): boolean {
  const address = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
  return new URL(address, 'http://localhost').pathname.startsWith('/api/auth/')
}

export async function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const began = session
  // fetch itself lets init.signal win over the signal of a Request.
  const signal = init?.signal ?? (input instanceof Request ? input.signal : undefined)
  const response = await fetch(input, init)
  if (response.status === 401 && !signal?.aborted && !isAccountEndpoint(input) && began === session) {
    startNewSession()
    onSessionExpired?.()
  }
  return response
}
