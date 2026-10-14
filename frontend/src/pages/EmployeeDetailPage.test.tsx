import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { EmployeeDetail } from '../api/employees'
import { AuthContext } from '../auth/AuthContext'
import { HR_MANAGER, flush, never, reply } from '../test/api'
import { CHOI_DETAIL, PARK_DETAIL, authAs, deferred } from '../test/employees'
import EmployeeDetailPage from './EmployeeDetailPage'

// T#38 criteria 2 and 3: the employee detail at /employees/:id (contract "상세", "불러오는 동안과 상태"). fetch is
// replaced; the router is a MemoryRouter and the login state is given directly.
function GoToSecond() {
  const navigate = useNavigate()
  return (
    <button type="button" onClick={() => navigate('/employees/2')}>
      go to 2
    </button>
  )
}

function stubFetch(handler: (url: string) => Promise<Response>) {
  const fetchMock = vi.fn((input: RequestInfo | URL) => handler(String(input)))
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function urls(fetchMock: ReturnType<typeof stubFetch>): string[] {
  return fetchMock.mock.calls.map(([input]) => String(input))
}

async function renderAt(path: string) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <AuthContext.Provider value={authAs(HR_MANAGER)}>
        <Routes>
          <Route path="/employees/:id" element={<EmployeeDetailPage />} />
        </Routes>
        <GoToSecond />
      </AuthContext.Provider>
    </MemoryRouter>,
  )
  await flush()
}

const main = () => screen.getByRole('main')

// The value next to a label of 기본 정보.
function info(label: string): string {
  const term = within(main()).getByText(label, { selector: 'dt' })
  return term.nextElementSibling?.textContent ?? ''
}

const barNames = () => screen.getAllByTestId('gantt-bar').map((bar) => bar.getAttribute('aria-label'))
const rows = () =>
  within(screen.getByRole('table'))
    .getAllByRole('row')
    .slice(1)
    .map((row) => within(row).getAllByRole('cell').map((cell) => cell.textContent))

describe('EmployeeDetailPage', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  // Criterion 2.
  it('shows the detail as the API returned it, once: head, basic information, skills, Gantt and the assignment table', async () => {
    const fetchMock = stubFetch(() => reply(200, PARK_DETAIL))

    await renderAt('/employees/1')

    expect(screen.getByRole('heading', { level: 1, name: '박소영' })).toBeInTheDocument()
    expect(urls(fetchMock)).toEqual(['/api/employees/1'])
    expect(within(main()).getByText('투입 가능')).toHaveAttribute('data-status', 'AVAILABLE')
    expect(within(main()).queryByText('확인 필요')).not.toBeInTheDocument()
    expect(within(main()).getByText('현재 가용률')).toBeInTheDocument()
    expect(within(main()).getByText('40%')).toBeInTheDocument()

    expect(within(main()).getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent)).toEqual([
      '기본 정보',
      '기술',
      '배치 현황',
    ])
    expect(['부서', '직무', '경력', '투입 불가 사유', '종료 예정일'].map(info)).toEqual([
      '개발팀',
      '백엔드 개발자',
      '5년',
      '—',
      '—',
    ])
    expect(within(main()).getAllByRole('listitem').map((item) => item.textContent)).toEqual(['Java · 고급'])

    expect(barNames()).toEqual([
      '감마 프로젝트, 2026-03-27 ~ 2026-05-16, 30%',
      '알파 프로젝트, 2026-09-23 ~ 2026-11-22, 60%',
    ])
    expect(screen.getAllByTestId('gantt-bar').map((bar) => bar.getAttribute('data-status'))).toEqual(['other', 'active'])
    expect(screen.getByText('오늘')).toBeInTheDocument()

    expect(within(screen.getByRole('table')).getAllByRole('columnheader').map((th) => th.textContent)).toEqual([
      '프로젝트',
      '기간',
      '투입률',
    ])
    expect(rows()).toEqual([
      ['감마 프로젝트', '2026-03-27 ~ 2026-05-16', '30%'],
      ['알파 프로젝트', '2026-09-23 ~ 2026-11-22', '60%'],
    ])
    expect(within(main()).queryAllByRole('button')).toEqual([])
  })

  it('draws the today line from the server date, not from the browser clock', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2001-01-01T00:00:00Z'))
    stubFetch(() => reply(200, PARK_DETAIL))

    await renderAt('/employees/1')

    expect(screen.getByRole('heading', { level: 1, name: '박소영' })).toBeInTheDocument()
    expect(screen.getByText('오늘')).toBeInTheDocument()
  })

  it('draws no today line when the server date is outside the chart', async () => {
    stubFetch(() => reply(200, { ...PARK_DETAIL, today: '2027-01-01' }))

    await renderAt('/employees/1')

    expect(screen.getByRole('heading', { level: 1, name: '박소영' })).toBeInTheDocument()
    expect(screen.queryByText('오늘')).not.toBeInTheDocument()
  })

  it('shows an unavailable employee with 확인 필요, the reason, the end date and the rate as given', async () => {
    stubFetch(() => reply(200, CHOI_DETAIL))

    await renderAt('/employees/2')

    expect(screen.getByRole('heading', { level: 1, name: '최동훈' })).toBeInTheDocument()
    expect(within(main()).getByText('투입 불가')).toHaveAttribute('data-status', 'UNAVAILABLE')
    expect(within(main()).getByText('확인 필요')).toHaveAttribute('data-status', 'NEEDS_REVIEW')
    expect(within(main()).getByText('37%')).toBeInTheDocument()
    expect(info('투입 불가 사유')).toBe('육아휴직')
    expect(info('종료 예정일')).toBe('2026-12-12')
    expect(within(main()).getAllByRole('listitem').map((item) => item.textContent)).toEqual(['React · 중급'])
  })

  it('shows one empty state and no table when the employee has no assignment', async () => {
    const empty: EmployeeDetail = { ...PARK_DETAIL, skills: [], assignments: [] }
    stubFetch(() => reply(200, empty))

    await renderAt('/employees/1')

    expect(screen.getByRole('heading', { level: 1, name: '박소영' })).toBeInTheDocument()
    expect(screen.getAllByRole('status').map((state) => state.textContent)).toEqual([
      expect.stringContaining('배치된 프로젝트가 없습니다'),
    ])
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    expect(within(main()).queryAllByRole('listitem')).toEqual([])
  })

  // Criterion 3.
  it('shows the spinner and 불러오는 중… while the detail is on its way', async () => {
    stubFetch(() => never())

    await renderAt('/employees/1')

    expect(screen.getByTestId('spinner')).toBeInTheDocument()
    expect(screen.getByText('불러오는 중…')).toBeInTheDocument()
    expect(main().querySelector('[aria-busy="true"]')).not.toBeNull()
  })

  for (const [kind, failure] of [
    ['a network error', () => Promise.reject(new TypeError('Failed to fetch'))],
    ['a 500 answer', () => reply(500, { code: 'X', message: '서버 오류' })],
    ['a 401 answer', () => reply(401, { code: 'AUTH_REQUIRED', message: '로그인이 필요합니다.' })],
  ] as const) {
    it(`shows the error state on ${kind}, and 다시 시도 asks again`, async () => {
      let call = 0
      const fetchMock = stubFetch(() => {
        call += 1
        return call === 1 ? failure() : reply(200, PARK_DETAIL)
      })

      await renderAt('/employees/1')

      expect(screen.getByRole('alert')).toBeInTheDocument()
      fireEvent.click(within(screen.getByRole('alert')).getByRole('button', { name: '다시 시도' }))
      await flush()

      expect(urls(fetchMock)).toEqual(['/api/employees/1', '/api/employees/1'])
      expect(screen.getByRole('heading', { level: 1, name: '박소영' })).toBeInTheDocument()
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })
  }

  it('says the employee was not found on a 404', async () => {
    stubFetch(() => reply(404, { code: 'EMPLOYEE_NOT_FOUND', message: '직원을 찾을 수 없습니다.' }))

    await renderAt('/employees/999')

    expect(within(screen.getByRole('alert')).getByText('직원을 찾을 수 없습니다.')).toBeInTheDocument()
  })

  for (const path of ['/employees/abc', '/employees/new', '/employees/0']) {
    it(`asks nothing for ${path} and says the employee was not found`, async () => {
      const fetchMock = stubFetch(() => reply(200, PARK_DETAIL))

      await renderAt(path)

      expect(within(screen.getByRole('alert')).getByText('직원을 찾을 수 없습니다.')).toBeInTheDocument()
      expect(fetchMock).not.toHaveBeenCalled()
    })
  }

  it('keeps the last address: a held answer for /employees/1 that comes after /employees/2 changes nothing', async () => {
    const first = deferred()
    let held = 0
    stubFetch((url) => {
      if (url === '/api/employees/1') {
        held += 1
        return first.promise
      }
      return reply(200, CHOI_DETAIL)
    })

    await renderAt('/employees/1')
    expect(held).toBe(1)
    expect(first.isReleased()).toBe(false)

    fireEvent.click(screen.getByRole('button', { name: 'go to 2' }))
    await flush()
    expect(screen.getByRole('heading', { level: 1, name: '최동훈' })).toBeInTheDocument()

    first.release(await reply(200, PARK_DETAIL))
    await flush()

    expect(first.isReleased()).toBe(true)
    expect(screen.getByRole('heading', { level: 1, name: '최동훈' })).toBeInTheDocument()
    expect(screen.queryByText('박소영')).not.toBeInTheDocument()
  })
})
