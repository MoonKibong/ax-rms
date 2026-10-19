import { fireEvent, render, screen, within } from '@testing-library/react'
import { Link, MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Dashboard } from '../api/dashboard'
import { flush, never, reply } from '../test/api'
import DashboardPage from './DashboardPage'

// T#18 criteria 3-5: the dashboard screen (contract "화면 동작"). fetch is replaced; the router is a MemoryRouter.
function Where() {
  const location = useLocation()
  return <output data-testid="where">{location.pathname + location.search}</output>
}

const FULL: Dashboard = {
  employeeCount: 1234,
  availableCount: 19,
  unavailableCount: 1,
  availableHeadcount: 18,
  ongoingProjectCount: 2,
  shortStaffedProjects: [
    {
      id: 7,
      name: '알파 프로젝트',
      requiredHeadcount: 2,
      assignedHeadcount: 1,
      missingSkills: [{ skill: 'Java', requiredHeadcount: 2 }],
    },
    { id: 9, name: '베타 프로젝트', requiredHeadcount: 3, assignedHeadcount: 2, missingSkills: [] },
  ],
  employees: [
    { id: 1, name: '박소영', currentAvailability: 40 },
    { id: 2, name: '최동훈', currentAvailability: 0 },
    { id: 3, name: '이수민', currentAvailability: 100 },
  ],
  departments: [
    { id: 1, name: '개발팀', averageAvailability: 70.6 },
    // JSON 72.0 arrives as the number 72.
    { id: 3, name: '디자인팀', averageAvailability: 72 },
  ],
  needsReview: [
    { id: 2, name: '최동훈' },
    { id: 12, name: '유시우' },
  ],
}

const EMPTY: Dashboard = {
  employeeCount: 0,
  availableCount: 0,
  unavailableCount: 0,
  availableHeadcount: 0,
  ongoingProjectCount: 0,
  shortStaffedProjects: [],
  employees: [],
  departments: [],
  needsReview: [],
}

const LIST_TITLES = ['확인 필요 배치', '인력 부족 프로젝트', '직원별 가용률', '부서별 평균 가용률']

function stubFetch(handler: (url: string) => Promise<Response>) {
  // Typed like fetch, so a test can read the RequestInit (its abort signal) of a call.
  const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>((input) =>
    handler(String(input)),
  )
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function urls(fetchMock: ReturnType<typeof stubFetch>): string[] {
  return fetchMock.mock.calls.map(([input]) => String(input))
}

// Another screen to leave to and come back from: "*" stands for every other address.
async function renderAt(path = '/') {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="*" element={<Link to="/">대시보드로</Link>} />
      </Routes>
      <Where />
    </MemoryRouter>,
  )
  await flush()
}

const where = () => screen.getByTestId('where').textContent
const region = (name: string) => screen.getByRole('region', { name })
const tiles = () => within(region('요약')).getAllByRole('link')
const items = (name: string) => within(region(name)).getAllByRole('listitem')

// A response the test releases by hand, so it can prove the request was really held.
function deferred() {
  let release: (response: Response) => void = () => undefined
  let released = false
  const promise = new Promise<Response>((resolve) => {
    release = (response) => {
      released = true
      resolve(response)
    }
  })
  return { promise, release, isReleased: () => released }
}

describe('DashboardPage tiles', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('asks GET /api/dashboard once and shows the five tiles in order with value, unit and list address', async () => {
    const fetchMock = stubFetch(() => reply(200, FULL))

    await renderAt()

    expect(urls(fetchMock)).toEqual(['/api/dashboard'])
    expect(screen.getByRole('heading', { level: 1, name: '대시보드' })).toBeInTheDocument()
    expect(tiles().map((tile) => [tile.textContent, tile.getAttribute('href')])).toEqual([
      ['전체 직원1,234명', '/employees'],
      ['투입 가능19명', '/employees?status=AVAILABLE'],
      ['투입 불가1명', '/employees?status=UNAVAILABLE'],
      ['가용 인원18명', '/employees?status=AVAILABLE'],
      ['진행 프로젝트2개', '/projects?status=IN_PROGRESS'],
    ])
  })

  it('goes to the list of a tile', async () => {
    stubFetch(() => reply(200, FULL))
    await renderAt()

    fireEvent.click(screen.getByRole('link', { name: /^진행 프로젝트/ }))
    await flush()

    expect(where()).toBe('/projects?status=IN_PROGRESS')
  })
})

describe('DashboardPage lists', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('shows the four lists in the order of BRIEF §6.2 with the titles of the PM decision', async () => {
    stubFetch(() => reply(200, FULL))
    await renderAt()

    expect(screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent)).toEqual(LIST_TITLES)
    for (const title of LIST_TITLES) {
      expect(region(title)).toBeInTheDocument()
    }
  })

  it('lists the employees to check with a 확인 필요 badge and a link to their detail', async () => {
    stubFetch(() => reply(200, FULL))
    await renderAt()

    const rows = items('확인 필요 배치')
    expect(rows.map((row) => row.textContent)).toEqual(['최동훈확인 필요', '유시우확인 필요'])
    expect(rows.map((row) => within(row).getByRole('link').getAttribute('href'))).toEqual(['/employees/2', '/employees/12'])
    for (const row of rows) {
      expect(within(row).getByText('확인 필요')).toHaveAttribute('data-status', 'NEEDS_REVIEW')
    }
  })

  it('lists the short-staffed projects with 인력 부족, the headcounts and the missing skills', async () => {
    stubFetch(() => reply(200, FULL))
    await renderAt()

    const [alpha, beta] = items('인력 부족 프로젝트')
    expect(within(alpha).getByRole('link', { name: '알파 프로젝트' })).toHaveAttribute('href', '/projects/7')
    expect(within(alpha).getByText('인력 부족')).toHaveAttribute('data-status', 'UNDERSTAFFED')
    expect(within(alpha).getByText('필요 2명 / 배치 1명')).toBeInTheDocument()
    expect(within(alpha).getByText('부족한 역량: Java 2명')).toBeInTheDocument()

    expect(within(beta).getByRole('link', { name: '베타 프로젝트' })).toHaveAttribute('href', '/projects/9')
    expect(within(beta).getByText('필요 3명 / 배치 2명')).toBeInTheDocument()
    expect(within(beta).queryByText(/부족한 역량/)).not.toBeInTheDocument()
  })

  it('lists every employee with the current availability as the API gives it', async () => {
    stubFetch(() => reply(200, FULL))
    await renderAt()

    const rows = items('직원별 가용률')
    expect(rows.map((row) => row.textContent)).toEqual(['박소영40%', '최동훈0%', '이수민100%'])
    expect(rows.map((row) => within(row).getByRole('link').getAttribute('href'))).toEqual([
      '/employees/1',
      '/employees/2',
      '/employees/3',
    ])
  })

  it('lists the department averages with one decimal place and a link to that department in the employee list', async () => {
    stubFetch(() => reply(200, FULL))
    await renderAt()

    const rows = items('부서별 평균 가용률')
    expect(rows.map((row) => row.textContent)).toEqual(['개발팀70.6%', '디자인팀72.0%'])
    expect(rows.map((row) => within(row).getByRole('link').getAttribute('href'))).toEqual([
      '/employees?departmentId=1',
      '/employees?departmentId=3',
    ])
  })

  it('goes to the detail of a listed employee', async () => {
    stubFetch(() => reply(200, FULL))
    await renderAt()

    fireEvent.click(within(region('직원별 가용률')).getByRole('link', { name: '박소영' }))
    await flush()

    expect(where()).toBe('/employees/1')
  })
})

describe('DashboardPage states', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('shows 불러오는 중… while the answer is held, and the dashboard once it is released', async () => {
    const held = deferred()
    const fetchMock = stubFetch(() => held.promise)
    await renderAt()

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(held.isReleased()).toBe(false)
    const loading = screen.getByText('불러오는 중…')
    expect(loading.closest('[aria-busy="true"]')).not.toBeNull()
    expect(screen.queryByRole('region', { name: '요약' })).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: '대시보드' })).toBeInTheDocument()

    held.release(await reply(200, FULL))
    await flush()

    expect(held.isReleased()).toBe(true)
    expect(screen.queryByText('불러오는 중…')).not.toBeInTheDocument()
    expect(tiles()).toHaveLength(5)
    expect(screen.getByRole('link', { name: /^전체 직원/ }).textContent).toBe('전체 직원1,234명')
  })

  it.each([
    ['a refused request', () => Promise.reject(new TypeError('Failed to fetch'))],
    ['a 500', () => reply(500, {})],
  ])('shows — in the tiles and an error in each list after %s; 다시 시도 asks once more', async (_name, fail) => {
    const answers = [fail, () => reply(200, FULL)]
    const fetchMock = stubFetch(() => (answers.shift() ?? never)())
    await renderAt()

    expect(tiles().map((tile) => [tile.textContent, tile.getAttribute('href')])).toEqual([
      ['전체 직원—', '/employees'],
      ['투입 가능—', '/employees?status=AVAILABLE'],
      ['투입 불가—', '/employees?status=UNAVAILABLE'],
      ['가용 인원—', '/employees?status=AVAILABLE'],
      ['진행 프로젝트—', '/projects?status=IN_PROGRESS'],
    ])
    for (const title of LIST_TITLES) {
      const alert = within(region(title)).getByRole('alert')
      expect(within(alert).getByText('데이터를 불러오지 못했습니다')).toBeInTheDocument()
      expect(within(alert).getByText('잠시 후 다시 시도하세요.')).toBeInTheDocument()
      expect(within(alert).getByRole('button', { name: '다시 시도' })).toBeInTheDocument()
    }
    expect(screen.getAllByRole('alert')).toHaveLength(4)

    fireEvent.click(within(region('부서별 평균 가용률')).getByRole('button', { name: '다시 시도' }))
    await flush()

    expect(urls(fetchMock)).toEqual(['/api/dashboard', '/api/dashboard'])
    expect(screen.queryAllByRole('alert')).toHaveLength(0)
    expect(screen.getByRole('link', { name: /^전체 직원/ }).textContent).toBe('전체 직원1,234명')
    expect(items('직원별 가용률')).toHaveLength(3)
  })

  it('sends one request when 다시 시도 is pressed twice', async () => {
    const answers = [() => reply(500, {}), never]
    const fetchMock = stubFetch(() => (answers.shift() ?? never)())
    await renderAt()

    const retry = within(region('확인 필요 배치')).getByRole('button', { name: '다시 시도' })
    fireEvent.click(retry)
    fireEvent.click(retry)
    await flush()

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(screen.getByText('불러오는 중…')).toBeInTheDocument()
  })

  it('shows the empty message of each list on its own', async () => {
    stubFetch(() => reply(200, EMPTY))
    await renderAt()

    const expected: Array<[string, string]> = [
      ['확인 필요 배치', '확인이 필요한 배치가 없습니다'],
      ['인력 부족 프로젝트', '인력이 부족한 프로젝트가 없습니다'],
      ['직원별 가용률', '등록된 직원이 없습니다'],
      ['부서별 평균 가용률', '등록된 부서가 없습니다'],
    ]
    for (const [title, message] of expected) {
      const status = within(region(title)).getByRole('status')
      expect(within(status).getByText(message)).toBeInTheDocument()
      expect(within(region(title)).queryByRole('list')).not.toBeInTheDocument()
    }
    expect(screen.queryAllByRole('alert')).toHaveLength(0)
    expect(screen.getByRole('link', { name: /^전체 직원/ }).textContent).toBe('전체 직원0명')
  })

  it('asks again each time the dashboard is opened (D36)', async () => {
    const fetchMock = stubFetch(() => reply(200, FULL))
    await renderAt()
    expect(fetchMock).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('link', { name: '직원' }))
    await flush()
    expect(where()).toBe('/employees')

    fireEvent.click(screen.getByRole('link', { name: '대시보드로' }))
    await flush()

    expect(where()).toBe('/')
    expect(urls(fetchMock)).toEqual(['/api/dashboard', '/api/dashboard'])
    expect(tiles()).toHaveLength(5)
  })

  it('drops the request when the screen is left before the answer', async () => {
    const held = deferred()
    const fetchMock = stubFetch(() => held.promise)
    await renderAt()
    expect(urls(fetchMock)).toEqual(['/api/dashboard'])
    expect(held.isReleased()).toBe(false)

    fireEvent.click(screen.getByRole('link', { name: '직원' }))
    await flush()
    const signal = fetchMock.mock.calls[0][1]?.signal
    expect(signal?.aborted).toBe(true)

    held.release(await reply(200, FULL))
    await flush()

    expect(held.isReleased()).toBe(true)
    expect(where()).toBe('/employees')
    expect(screen.queryByRole('region', { name: '요약' })).not.toBeInTheDocument()
  })
})
