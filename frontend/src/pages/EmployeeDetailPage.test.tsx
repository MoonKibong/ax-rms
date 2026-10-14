import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { EmployeeDetail } from '../api/employees'
import { AuthContext, type CurrentUser } from '../auth/AuthContext'
import { DUAL_MANAGER, HR_MANAGER, flush, never, reply } from '../test/api'
import { CHOI_DETAIL, PARK_DETAIL, PROJECT_MANAGER, authAs, deferred } from '../test/employees'
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

// T#39: where the router is, to see where "수정" goes. A plain span: an <output> would be one more role="status".
function Where() {
  return <span data-testid="where">{useLocation().pathname}</span>
}

function stubFetch(handler: (url: string, init?: RequestInit) => Promise<Response>) {
  const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => handler(String(input), init))
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function urls(fetchMock: ReturnType<typeof stubFetch>): string[] {
  return fetchMock.mock.calls.map(([input]) => String(input))
}

async function renderAt(path: string, user: CurrentUser = HR_MANAGER) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <AuthContext.Provider value={authAs(user)}>
        <Routes>
          <Route path="/employees/:id" element={<EmployeeDetailPage />} />
          <Route path="/employees/:id/edit" element={<p>수정 화면</p>} />
        </Routes>
        <GoToSecond />
        <Where />
      </AuthContext.Provider>
    </MemoryRouter>,
  )
  await flush()
}

const where = () => screen.getByTestId('where').textContent

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
    // T#39 criterion 4 replaces the T#38 "no button" assertion: an HR manager has 수정 and 상태 변경, in that order.
    expect(within(main()).getAllByRole('button').map((button) => button.textContent)).toEqual(['수정', '상태 변경'])
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

// T#39 criterion 4: the management buttons of the detail (BRIEF §6.4 item 5), for an HR manager only. Hiding them
// below 1024px is CSS, which jsdom does not apply; the e2e of criterion 8 measures it.
describe('EmployeeDetailPage management buttons', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  for (const user of [HR_MANAGER, DUAL_MANAGER]) {
    it(`gives ${user.username} 수정 and 상태 변경, and 수정 goes to the edit form`, async () => {
      stubFetch(() => reply(200, PARK_DETAIL))

      await renderAt('/employees/1', user)

      expect(screen.getByRole('button', { name: '수정' })).toBeInTheDocument()
      expect(within(main()).getAllByRole('button').map((button) => button.textContent)).toEqual(['수정', '상태 변경'])
      fireEvent.click(screen.getByRole('button', { name: '수정' }))
      await flush()
      expect(where()).toBe('/employees/1/edit')
    })
  }

  it('gives project.manager no button', async () => {
    stubFetch(() => reply(200, PARK_DETAIL))

    await renderAt('/employees/1', PROJECT_MANAGER)

    expect(screen.getByRole('heading', { level: 1, name: '박소영' })).toBeInTheDocument()
    expect(within(main()).queryAllByRole('button')).toEqual([])
  })
})

// T#39 criterion 7: the status change dialog (D6, D21, D33, contract "상태 변경 대화상자").
describe('EmployeeDetailPage status change', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  type Patch = { url: string; body: unknown }

  // GET answers `detail`; PATCH is recorded and answered by `patch`.
  function stubStatus(detail: EmployeeDetail, patch: (call: Patch) => Promise<Response> = () => never()) {
    const patches: Patch[] = []
    const fetchMock = stubFetch((url, init) => {
      if (init?.method === 'PATCH') {
        const call = { url, body: JSON.parse(String(init.body)) }
        patches.push(call)
        return patch(call)
      }
      return reply(200, detail)
    })
    return { patches, fetchMock }
  }

  const dialog = () => screen.getByRole('dialog', { name: '상태 변경' })
  const statusSelect = () => within(dialog()).getByRole('combobox', { name: '상태' })
  const reasonInput = () => within(dialog()).getByRole('textbox', { name: '사유' })
  const untilInput = () => within(dialog()).getByLabelText('종료 예정일')
  const statusButton = () => screen.getByRole('button', { name: '상태 변경' })

  async function openDialog() {
    fireEvent.click(statusButton())
    await flush()
    expect(dialog()).toBeInTheDocument()
  }

  async function saveDialog() {
    fireEvent.click(within(dialog()).getByRole('button', { name: '저장' }))
    await flush()
  }

  it('opens with the current status and shows reason and end date only for 투입 불가', async () => {
    stubStatus(PARK_DETAIL)
    await renderAt('/employees/1')

    await openDialog()

    expect(statusSelect()).toHaveValue('AVAILABLE')
    expect(within(statusSelect()).getAllByRole('option').map((option) => option.textContent)).toEqual(['투입 가능', '투입 불가'])
    expect(within(dialog()).queryByRole('textbox', { name: '사유' })).not.toBeInTheDocument()
    fireEvent.change(statusSelect(), { target: { value: 'UNAVAILABLE' } })
    expect(reasonInput()).toHaveValue('')
    expect(reasonInput()).toBeRequired()
    expect(untilInput()).toHaveAttribute('type', 'date')
    fireEvent.change(statusSelect(), { target: { value: 'AVAILABLE' } })
    expect(within(dialog()).queryByRole('textbox', { name: '사유' })).not.toBeInTheDocument()
    expect(within(dialog()).queryByLabelText('종료 예정일')).not.toBeInTheDocument()
  })

  it('opens 최동훈 with the current reason and end date', async () => {
    stubStatus(CHOI_DETAIL)
    await renderAt('/employees/2')

    await openDialog()

    expect(statusSelect()).toHaveValue('UNAVAILABLE')
    expect(reasonInput()).toHaveValue('육아휴직')
    expect(untilInput()).toHaveValue('2026-12-12')
  })

  it('sends the trimmed reason and the end date, or null for an empty end date', async () => {
    const { patches } = stubStatus(PARK_DETAIL, () => reply(400, { code: 'X', message: '실패' }))
    await renderAt('/employees/1')
    await openDialog()

    fireEvent.change(statusSelect(), { target: { value: 'UNAVAILABLE' } })
    fireEvent.change(reasonInput(), { target: { value: ' 교육 ' } })
    fireEvent.change(untilInput(), { target: { value: '2026-12-31' } })
    await saveDialog()
    fireEvent.change(untilInput(), { target: { value: '' } })
    await saveDialog()

    expect(patches).toEqual([
      {
        url: '/api/employees/1/status',
        body: { availabilityStatus: 'UNAVAILABLE', unavailableReason: '교육', unavailableUntil: '2026-12-31' },
      },
      {
        url: '/api/employees/1/status',
        body: { availabilityStatus: 'UNAVAILABLE', unavailableReason: '교육', unavailableUntil: null },
      },
    ])
  })

  it('sends null reason and end date when 최동훈 becomes 투입 가능', async () => {
    const { patches } = stubStatus(CHOI_DETAIL, () => reply(400, { code: 'X', message: '실패' }))
    await renderAt('/employees/2')
    await openDialog()

    fireEvent.change(statusSelect(), { target: { value: 'AVAILABLE' } })
    await saveDialog()

    expect(patches).toEqual([
      {
        url: '/api/employees/2/status',
        body: { availabilityStatus: 'AVAILABLE', unavailableReason: null, unavailableUntil: null },
      },
    ])
  })

  it('puts EMPLOYEE_REASON_REQUIRED under the reason and EMPLOYEE_STATUS_INVALID under the status', async () => {
    let call = 0
    stubStatus(PARK_DETAIL, () => {
      call += 1
      return call === 1
        ? reply(400, { code: 'EMPLOYEE_REASON_REQUIRED', message: '투입 불가 사유를 입력하세요.' })
        : reply(400, { code: 'EMPLOYEE_STATUS_INVALID', message: '투입 상태 값이 올바르지 않습니다.' })
    })
    await renderAt('/employees/1')
    await openDialog()
    fireEvent.change(statusSelect(), { target: { value: 'UNAVAILABLE' } })

    await saveDialog()
    expect(reasonInput()).toHaveAttribute('aria-invalid', 'true')
    expect(reasonInput()).toHaveAccessibleDescription('투입 불가 사유를 입력하세요.')

    await saveDialog()
    expect(reasonInput()).not.toHaveAttribute('aria-invalid')
    expect(statusSelect()).toHaveAttribute('aria-invalid', 'true')
    expect(statusSelect()).toHaveAccessibleDescription('투입 상태 값이 올바르지 않습니다.')
  })

  for (const [kind, answer, expected] of [
    ['403', () => reply(403, { code: 'AUTH_FORBIDDEN', message: '이 작업을 할 권한이 없습니다.' }), '이 작업을 할 권한이 없습니다.'],
    ['500', () => reply(500, { code: 'X', message: '서버 오류' }), '서버 오류'],
    ['a network error', () => Promise.reject(new TypeError('Failed to fetch')), '저장하지 못했습니다. 잠시 후 다시 시도하세요.'],
  ] as const) {
    it(`shows ${kind} as the dialog message`, async () => {
      stubStatus(PARK_DETAIL, answer)
      await renderAt('/employees/1')
      await openDialog()

      await saveDialog()

      expect(within(dialog()).getByRole('alert')).toHaveTextContent(expected)
    })
  }

  it('closes on success and shows the answered detail without asking again; the focus is back on 상태 변경', async () => {
    const changed: EmployeeDetail = {
      ...PARK_DETAIL,
      availabilityStatus: 'UNAVAILABLE',
      unavailableReason: '교육',
      unavailableUntil: '2026-12-31',
      needsReview: true,
    }
    const { fetchMock } = stubStatus(PARK_DETAIL, () => reply(200, changed))
    await renderAt('/employees/1')
    const rowsBefore = rows().length
    await openDialog()
    fireEvent.change(statusSelect(), { target: { value: 'UNAVAILABLE' } })
    fireEvent.change(reasonInput(), { target: { value: '교육' } })

    await saveDialog()

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(within(main()).getByText('투입 불가')).toHaveAttribute('data-status', 'UNAVAILABLE')
    expect(within(main()).getByText('확인 필요')).toBeInTheDocument()
    expect(info('투입 불가 사유')).toBe('교육')
    expect(info('종료 예정일')).toBe('2026-12-31')
    expect(rows()).toHaveLength(rowsBefore)
    expect(document.activeElement).toBe(statusButton())
    expect(urls(fetchMock).filter((url) => url === '/api/employees/1')).toHaveLength(1)
  })

  for (const how of ['취소', 'Escape'] as const) {
    it(`closes on ${how} without saving, and the focus is back on 상태 변경`, async () => {
      const { patches } = stubStatus(PARK_DETAIL)
      await renderAt('/employees/1')
      await openDialog()
      fireEvent.change(statusSelect(), { target: { value: 'UNAVAILABLE' } })

      if (how === '취소') {
        fireEvent.click(within(dialog()).getByRole('button', { name: '취소' }))
      } else {
        fireEvent.keyDown(statusSelect(), { key: 'Escape' })
      }
      await flush()

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      expect(patches).toEqual([])
      expect(document.activeElement).toBe(statusButton())
      await openDialog()
      expect(statusSelect()).toHaveValue('AVAILABLE')
    })
  }

  it('keeps one request while the save is held: 취소 is disabled, Escape does not close, 저장 again sends nothing', async () => {
    const held = deferred()
    const { patches } = stubStatus(PARK_DETAIL, () => held.promise)
    await renderAt('/employees/1')
    await openDialog()

    await saveDialog()
    expect(patches).toHaveLength(1)
    expect(held.isReleased()).toBe(false)
    expect(within(dialog()).getByRole('button', { name: '취소' })).toBeDisabled()
    fireEvent.keyDown(statusSelect(), { key: 'Escape' })
    await saveDialog()

    expect(dialog()).toBeInTheDocument()
    expect(patches).toHaveLength(1)
    held.release(await reply(200, PARK_DETAIL))
    await flush()
    expect(held.isReleased()).toBe(true)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
