import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AuthContext, type CurrentUser } from '../auth/AuthContext'
import { EMPLOYEE_ONLY, HR_MANAGER, flush, never, reply } from '../test/api'
import { HAN_DETAIL, LEE_DETAIL, PARK_DETAIL, authAs } from '../test/employees'
import MePage from './MePage'

// T#38 criterion 4: 내 정보 is the logged-in account's own detail from GET /api/me/employee, read-only (D24, D25).
function stubFetch(handler: (url: string) => Promise<Response>) {
  const fetchMock = vi.fn((input: RequestInfo | URL) => handler(String(input)))
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function urls(fetchMock: ReturnType<typeof stubFetch>): string[] {
  return fetchMock.mock.calls.map(([input]) => String(input))
}

async function renderMe(user: CurrentUser) {
  render(
    <MemoryRouter initialEntries={['/me']}>
      <AuthContext.Provider value={authAs(user)}>
        <MePage />
      </AuthContext.Provider>
    </MemoryRouter>,
  )
  await flush()
}

const main = () => screen.getByRole('main')

describe('MePage', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('shows an employee-only account its own detail from GET /api/me/employee, once, with no button', async () => {
    const fetchMock = stubFetch((url) => (url === '/api/me/employee' ? reply(200, HAN_DETAIL) : reply(404, {})))

    await renderMe(EMPLOYEE_ONLY)

    expect(urls(fetchMock).filter((url) => url === '/api/me/employee')).toHaveLength(1)
    expect(urls(fetchMock).filter((url) => url.startsWith('/api/employees'))).toEqual([])
    expect(screen.getByRole('heading', { level: 1, name: '내 정보' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: '한지우' })).toBeInTheDocument()
    expect(within(main()).getByText('투입 가능')).toHaveAttribute('data-status', 'AVAILABLE')
    expect(within(main()).getByText('100%')).toBeInTheDocument()
    expect(within(main()).getAllByRole('listitem').map((item) => item.textContent)).toEqual(['Java · 초급'])
    expect(within(main()).getByText('배치된 프로젝트가 없습니다')).toBeInTheDocument()
    expect(within(main()).queryAllByRole('button')).toEqual([])
  })

  it('shows a manager the same read-only detail of its own, with the Gantt and the assignment table', async () => {
    const own = { ...LEE_DETAIL, assignments: PARK_DETAIL.assignments }
    const fetchMock = stubFetch((url) => (url === '/api/me/employee' ? reply(200, own) : reply(404, {})))

    await renderMe(HR_MANAGER)

    expect(urls(fetchMock)).toEqual(['/api/me/employee'])
    expect(screen.getByRole('heading', { level: 2, name: '이수민' })).toBeInTheDocument()
    expect(screen.getAllByTestId('gantt-bar')).toHaveLength(2)
    expect(
      within(screen.getByRole('table'))
        .getAllByRole('row')
        .slice(1)
        .map((row) => within(row).getAllByRole('cell').map((cell) => cell.textContent)),
    ).toEqual([
      ['감마 프로젝트', '2026-03-27 ~ 2026-05-16', '30%'],
      ['알파 프로젝트', '2026-09-23 ~ 2026-11-22', '60%'],
    ])
    expect(within(main()).queryAllByRole('button')).toEqual([])
  })

  it('shows the spinner while the detail is on its way', async () => {
    stubFetch(() => never())

    await renderMe(EMPLOYEE_ONLY)

    expect(screen.getByTestId('spinner')).toBeInTheDocument()
    expect(screen.getByText('불러오는 중…')).toBeInTheDocument()
  })

  it('shows the error state on a 500 answer, and 다시 시도 asks again', async () => {
    let call = 0
    const fetchMock = stubFetch(() => {
      call += 1
      return call === 1 ? reply(500, { code: 'X', message: '서버 오류' }) : reply(200, HAN_DETAIL)
    })

    await renderMe(EMPLOYEE_ONLY)

    // The login's name stays above the error, so the page still says whose it is (T#6 showed it here).
    expect(screen.getByRole('heading', { level: 2, name: '한지우' })).toBeInTheDocument()
    fireEvent.click(within(screen.getByRole('alert')).getByRole('button', { name: '다시 시도' }))
    await flush()

    expect(urls(fetchMock)).toEqual(['/api/me/employee', '/api/me/employee'])
    expect(screen.getByRole('heading', { level: 2, name: '한지우' })).toBeInTheDocument()
  })
})
