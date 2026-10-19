import { afterEach, describe, expect, it, vi } from 'vitest'
import { reply } from '../test/api'
import { apiFetch, setSessionExpiredHandler } from './client'

// T#55 criteria 5–7 and 10: the one place that sees a 401 of a business request.
const sources = import.meta.glob(['../**/*.ts', '../**/*.tsx', '!../**/*.test.ts', '!../**/*.test.tsx', '!../test/**'], {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

describe('apiFetch', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    setSessionExpiredHandler(null)
  })

  // Criterion 7.
  it('calls the global fetch once with the same url and the same init, and returns the response as it is', async () => {
    const response = await reply(401, { code: 'AUTH_REQUIRED', message: '로그인이 필요합니다.' })
    const fetchMock = vi.fn(() => Promise.resolve(response))
    vi.stubGlobal('fetch', fetchMock)
    const controller = new AbortController()
    const init: RequestInit = {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{"a":1}',
      signal: controller.signal,
    }
    setSessionExpiredHandler(() => undefined)

    const result = await apiFetch('/api/projects', init)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0]).toHaveLength(2)
    const [url, sent] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('/api/projects')
    expect(sent).toBe(init)
    expect(result).toBe(response)
  })

  it('reports an expired session once per 401 of a business request, and nothing else', async () => {
    const handler = vi.fn()
    setSessionExpiredHandler(handler)
    vi.stubGlobal('fetch', vi.fn(() => reply(200, {})))
    await apiFetch('/api/dashboard')
    vi.stubGlobal('fetch', vi.fn(() => reply(500, {})))
    await apiFetch('/api/dashboard')
    vi.stubGlobal('fetch', vi.fn(() => reply(403, {})))
    await apiFetch('/api/dashboard')
    expect(handler).not.toHaveBeenCalled()

    vi.stubGlobal('fetch', vi.fn(() => reply(401, {})))
    await apiFetch('/api/dashboard')
    expect(handler).toHaveBeenCalledTimes(1)
  })

  // Criterion 5: the answers of the account endpoints are not an expired session.
  it.each(['/api/auth/login', '/api/auth/me', '/api/auth/logout'])('does not take a 401 of %s for an expired session', async (url) => {
    const handler = vi.fn()
    setSessionExpiredHandler(handler)
    vi.stubGlobal('fetch', vi.fn(() => reply(401, {})))

    await apiFetch(url, { method: 'POST' })

    expect(handler).not.toHaveBeenCalled()
  })

  // Criterion 6.
  it('passes a cancelled request on as it is and does not take it for an expired session', async () => {
    const handler = vi.fn()
    setSessionExpiredHandler(handler)
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new DOMException('aborted', 'AbortError'))))

    await expect(apiFetch('/api/dashboard')).rejects.toMatchObject({ name: 'AbortError' })

    const controller = new AbortController()
    controller.abort()
    vi.stubGlobal('fetch', vi.fn(() => reply(401, {})))
    await apiFetch('/api/dashboard', { signal: controller.signal })
    expect(handler).not.toHaveBeenCalled()
  })

  it('does not take the 401 of a cancelled Request for an expired session, and lets init.signal override the signal of the Request', async () => {
    const handler = vi.fn()
    setSessionExpiredHandler(handler)
    vi.stubGlobal('fetch', vi.fn(() => reply(401, {})))
    const controller = new AbortController()
    controller.abort()

    await apiFetch(new Request('http://localhost/api/dashboard', { signal: controller.signal }))
    expect(handler).not.toHaveBeenCalled()

    // init.signal wins over the signal of the Request, as it does for fetch itself: a live init.signal makes it a live request.
    await apiFetch(new Request('http://localhost/api/dashboard', { signal: controller.signal }), { signal: new AbortController().signal })
    expect(handler).toHaveBeenCalledTimes(1)
  })

  // Criterion 10: no screen asks for a business answer by itself.
  it('is the only way the code outside the account endpoints calls fetch', () => {
    const allowed = ['./client.ts', '../auth/AuthContext.tsx', '../pages/LoginPage.tsx', '../App.tsx']
    const direct = Object.entries(sources)
      .filter(([, text]) =>
        text
          .split('\n')
          .filter((line) => !line.trim().startsWith('//'))
          .some((line) => /(^|[^.\w])fetch\(/.test(line)),
      )
      .map(([path]) => path)
      .sort()

    expect(direct).toEqual([...allowed].sort())
  })
})
