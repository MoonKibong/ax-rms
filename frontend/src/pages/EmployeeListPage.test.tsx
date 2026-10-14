import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { EmployeeListItem } from '../api/employees'
import { AuthContext } from '../auth/AuthContext'
import { DUAL_MANAGER, HR_MANAGER, flush, never, reply } from '../test/api'
import { PROJECT_MANAGER, authAs } from '../test/employees'
import EmployeeListPage from './EmployeeListPage'

// T#13 criteria 4-8: the employee list screen (contract "화면 동작"). fetch is replaced; the router is a MemoryRouter.
function Where() {
  const location = useLocation()
  return <output data-testid="where">{location.pathname + location.search}</output>
}

const PARK: EmployeeListItem = {
  id: 1,
  name: '박소영',
  departmentId: 1,
  departmentName: '개발팀',
  jobTitle: '백엔드 개발자',
  careerYears: 5,
  availabilityStatus: 'AVAILABLE',
  currentAvailability: 40,
  needsReview: false,
  skills: [
    { skillName: 'Java', proficiencyLevel: 'ADVANCED' },
    { skillName: 'React', proficiencyLevel: 'BEGINNER' },
  ],
}
const CHOI: EmployeeListItem = {
  id: 2,
  name: '최동훈',
  departmentId: 1,
  departmentName: '개발팀',
  jobTitle: '프런트엔드 개발자',
  careerYears: 3,
  availabilityStatus: 'UNAVAILABLE',
  currentAvailability: 60,
  needsReview: true,
  skills: [{ skillName: 'React', proficiencyLevel: 'INTERMEDIATE' }],
}
const LEE: EmployeeListItem = {
  id: 3,
  name: '이수민',
  departmentId: 2,
  departmentName: '기획팀',
  jobTitle: '인사 담당',
  careerYears: 7,
  availabilityStatus: 'AVAILABLE',
  currentAvailability: 100,
  needsReview: false,
  skills: [],
}
const OH: EmployeeListItem = {
  id: 6,
  name: '오승현',
  departmentId: 3,
  departmentName: '디자인팀',
  jobTitle: '디자인팀장',
  careerYears: 10,
  availabilityStatus: 'AVAILABLE',
  currentAvailability: 0,
  needsReview: false,
  skills: [],
}
const ALL = [PARK, CHOI, LEE, OH]

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
      <EmployeeListPage />
      <Where />
    </MemoryRouter>,
  )
  await flush()
}

const where = () => screen.getByTestId('where').textContent
const names = () => screen.getAllByRole('row').slice(1).map((row) => within(row).getAllByRole('cell')[0].textContent)
const optionsOf = (label: string) =>
  within(screen.getByLabelText(label))
    .getAllByRole('option')
    .map((option) => option.textContent)
const valuesOf = (label: string) =>
  within(screen.getByLabelText(label))
    .getAllByRole('option')
    .map((option) => option.getAttribute('value'))

async function choose(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } })
  await flush()
}

async function search(value: string) {
  fireEvent.change(screen.getByLabelText('이름 검색'), { target: { value } })
  await flush()
}

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

describe('EmployeeListPage', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  // Criterion 4.
  it('lists the employees as the API returned them, once, with names that link to the detail, badges, skills and the rate format', async () => {
    const fetchMock = stubFetch(() => reply(200, ALL))

    await renderAt('/employees')

    expect(screen.getByRole('cell', { name: '박소영' })).toBeInTheDocument()
    expect(urls(fetchMock)).toEqual(['/api/employees'])
    expect(screen.getByRole('heading', { level: 1, name: '직원' })).toBeInTheDocument()
    expect(screen.getAllByRole('columnheader').map((th) => th.textContent)).toEqual([
      '이름',
      '부서',
      '직무',
      '기술',
      '투입 상태',
      '현재 가용률',
      '확인 필요',
    ])
    const rows = screen.getAllByRole('row').slice(1)
    expect(rows.map((row) => within(row).getAllByRole('cell').map((cell) => cell.textContent))).toEqual([
      ['박소영', '개발팀', '백엔드 개발자', 'Java, React', '투입 가능', '40%', '—'],
      ['최동훈', '개발팀', '프런트엔드 개발자', 'React', '투입 불가', '60%', '확인 필요'],
      ['이수민', '기획팀', '인사 담당', '—', '투입 가능', '100%', '—'],
      ['오승현', '디자인팀', '디자인팀장', '—', '투입 가능', '0%', '—'],
    ])
    expect(within(rows[0]).getByText('투입 가능')).toHaveAttribute('data-status', 'AVAILABLE')
    expect(within(rows[1]).getByText('투입 불가')).toHaveAttribute('data-status', 'UNAVAILABLE')
    expect(within(rows[1]).getByText('확인 필요')).toHaveAttribute('data-status', 'NEEDS_REVIEW')
    // T#38 criterion 6 (was "no link" in T#13, which handed the detail link to the detail task): each name links to
    // the employee's detail, and the names are the only links in the table.
    const links = within(screen.getByRole('table')).getAllByRole('link')
    expect(links.map((link) => [link.textContent, link.getAttribute('href')])).toEqual([
      ['박소영', '/employees/1'],
      ['최동훈', '/employees/2'],
      ['이수민', '/employees/3'],
      ['오승현', '/employees/6'],
    ])
    expect(document.querySelectorAll('table a')).toHaveLength(rows.length)
    expect(screen.getByText('4명')).toBeInTheDocument()
  })

  // Criterion 5.
  it('builds the choices from the unfiltered answer: departments by id, skills once each in Korean order', async () => {
    const mixed: EmployeeListItem[] = [
      { ...OH, id: 1, skills: [{ skillName: 'React', proficiencyLevel: 'ADVANCED' }] },
      { ...PARK, id: 2, skills: [{ skillName: 'Java', proficiencyLevel: 'ADVANCED' }] },
      { ...LEE, id: 3, skills: [{ skillName: 'React', proficiencyLevel: 'BEGINNER' }] },
    ]
    stubFetch(() => reply(200, mixed))

    await renderAt('/employees')

    expect(optionsOf('부서')).toEqual(['전체', '개발팀', '기획팀', '디자인팀'])
    expect(valuesOf('부서')).toEqual(['', '1', '2', '3'])
    expect(optionsOf('기술')).toEqual(['전체', 'Java', 'React'])
    expect(valuesOf('기술')).toEqual(['', 'Java', 'React'])
    expect(optionsOf('투입 상태')).toEqual(['전체', '투입 가능', '투입 불가'])
    expect(valuesOf('투입 상태')).toEqual(['', 'AVAILABLE', 'UNAVAILABLE'])
    expect(optionsOf('가용률')).toEqual(['전체', '30% 이상', '50% 이상', '70% 이상', '100%'])
    expect(valuesOf('가용률')).toEqual(['', '30', '50', '70', '100'])
  })

  it('keeps the 부서 and 기술 choices when a filter narrows the result, and asks without a query only once', async () => {
    const fetchMock = stubFetch((url) => reply(200, url === '/api/employees' ? ALL : [CHOI]))
    await renderAt('/employees')

    await choose('투입 상태', 'UNAVAILABLE')
    expect(urls(fetchMock)).toEqual(['/api/employees', '/api/employees?status=UNAVAILABLE'])
    expect(where()).toBe('/employees?status=UNAVAILABLE')
    expect(names()).toEqual(['최동훈'])
    expect(optionsOf('부서')).toEqual(['전체', '개발팀', '기획팀', '디자인팀'])
    expect(optionsOf('기술')).toEqual(['전체', 'Java', 'React'])

    await choose('부서', '1')
    expect(urls(fetchMock)).toEqual([
      '/api/employees',
      '/api/employees?status=UNAVAILABLE',
      '/api/employees?departmentId=1&status=UNAVAILABLE',
    ])
    expect(optionsOf('부서')).toEqual(['전체', '개발팀', '기획팀', '디자인팀'])
    expect(optionsOf('기술')).toEqual(['전체', 'Java', 'React'])
    expect(urls(fetchMock).filter((url) => url === '/api/employees')).toHaveLength(1)
  })

  it('sends the trimmed name and each filter in the fixed order, and keeps them in the address', async () => {
    const fetchMock = stubFetch(() => reply(200, ALL))
    await renderAt('/employees')
    const last = () => urls(fetchMock).at(-1)

    await search('  지 ')
    expect(last()).toBe('/api/employees?name=%EC%A7%80')
    expect(screen.getByLabelText('이름 검색')).toHaveValue('  지 ')

    await choose('기술', 'Java')
    expect(last()).toBe('/api/employees?name=%EC%A7%80&skill=Java')
    await choose('가용률', '50')
    expect(last()).toBe('/api/employees?name=%EC%A7%80&skill=Java&minAvailability=50')
    await choose('부서', '2')
    expect(last()).toBe('/api/employees?name=%EC%A7%80&departmentId=2&skill=Java&minAvailability=50')
    await choose('투입 상태', 'AVAILABLE')
    expect(last()).toBe('/api/employees?name=%EC%A7%80&departmentId=2&skill=Java&status=AVAILABLE&minAvailability=50')

    const params = new URLSearchParams(where()?.split('?')[1])
    expect(Object.fromEntries(params)).toEqual({
      name: '  지 ',
      departmentId: '2',
      skill: 'Java',
      status: 'AVAILABLE',
      minAvailability: '50',
    })
  })

  it('starts from valid filters in the address: the unfiltered answer first, then the filtered one', async () => {
    const fetchMock = stubFetch((url) => reply(200, url === '/api/employees' ? ALL : [CHOI]))

    await renderAt('/employees?status=UNAVAILABLE&minAvailability=50')

    expect(urls(fetchMock)).toEqual(['/api/employees', '/api/employees?status=UNAVAILABLE&minAvailability=50'])
    expect(screen.getByLabelText('투입 상태')).toHaveValue('UNAVAILABLE')
    expect(screen.getByLabelText('가용률')).toHaveValue('50')
    expect(names()).toEqual(['최동훈'])
  })

  it.each([
    ['/employees?status=bogus&minAvailability=33&departmentId=abc&skill=없는기술&name=%20'],
    ['/employees?departmentId=9&skill=java&minAvailability=5'],
  ])('treats values in %s that are not choices as 전체 and never sends them', async (path) => {
    const fetchMock = stubFetch(() => reply(200, ALL))

    await renderAt(path)

    expect(urls(fetchMock)).toEqual(['/api/employees'])
    for (const label of ['부서', '기술', '투입 상태', '가용률']) {
      expect(screen.getByLabelText(label), label).toHaveValue('')
    }
    expect(names()).toEqual(['박소영', '최동훈', '이수민', '오승현'])
  })

  it('shows the error state when the choices cannot be loaded, and 다시 시도 asks for them again', async () => {
    let attempt = 0
    const fetchMock = stubFetch(() => {
      attempt += 1
      return attempt === 1 ? reply(500, { code: 'X', message: 'x' }) : reply(200, ALL)
    })
    await renderAt('/employees')

    const alert = screen.getByRole('alert')
    expect(within(alert).getByText('데이터를 불러오지 못했습니다')).toBeInTheDocument()
    fireEvent.click(within(alert).getByRole('button', { name: '다시 시도' }))
    await flush()

    expect(urls(fetchMock)).toEqual(['/api/employees', '/api/employees'])
    expect(optionsOf('부서')).toEqual(['전체', '개발팀', '기획팀', '디자인팀'])
    expect(names()).toEqual(['박소영', '최동훈', '이수민', '오승현'])
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  // Criterion 6.
  it('shows the spinner and 불러오는 중… in a busy area until the answer arrives', async () => {
    stubFetch(() => never())

    await renderAt('/employees')

    expect(screen.getByText('불러오는 중…')).toBeInTheDocument()
    expect(screen.getByText('불러오는 중…').closest('[aria-busy="true"]')).not.toBeNull()
    expect(screen.getByTestId('spinner').closest('[aria-busy="true"]')).not.toBeNull()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    expect(screen.getByLabelText('이름 검색')).toBeInTheDocument()
  })

  it.each([
    ['a network error', () => Promise.reject(new TypeError('Failed to fetch'))],
    ['a 500 answer', () => reply(500, { code: 'X', message: 'x' })],
    ['a 401 answer', () => reply(401, { code: 'AUTH_REQUIRED', message: '로그인이 필요합니다.' })],
  ])('shows the error state for %s on the filtered request, and 다시 시도 sends that request again', async (_label, failing) => {
    let filtered = 0
    const fetchMock = stubFetch((url) => {
      if (url === '/api/employees') return reply(200, ALL)
      filtered += 1
      return filtered === 1 ? failing() : reply(200, [CHOI])
    })

    await renderAt('/employees?status=UNAVAILABLE')

    const alert = screen.getByRole('alert')
    expect(within(alert).getByText('데이터를 불러오지 못했습니다')).toBeInTheDocument()
    fireEvent.click(within(alert).getByRole('button', { name: '다시 시도' }))
    await flush()

    expect(urls(fetchMock)).toEqual([
      '/api/employees',
      '/api/employees?status=UNAVAILABLE',
      '/api/employees?status=UNAVAILABLE',
    ])
    expect(names()).toEqual(['최동훈'])
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('shows 등록된 직원이 없습니다 for no employees at all', async () => {
    stubFetch(() => reply(200, []))

    await renderAt('/employees')

    expect(screen.getByText('등록된 직원이 없습니다')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '필터 초기화' })).not.toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    expect(screen.queryByText('0명')).not.toBeInTheDocument()
    expect(optionsOf('부서')).toEqual(['전체'])
    expect(optionsOf('기술')).toEqual(['전체'])
  })

  it('shows no-results for an empty filtered answer, and 필터 초기화 clears everything and asks without filters', async () => {
    const fetchMock = stubFetch((url) => reply(200, url === '/api/employees' ? ALL : []))
    await renderAt('/employees?name=%EC%97%86&status=UNAVAILABLE')

    expect(screen.getByText('조건에 맞는 직원이 없습니다')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '필터 초기화' }))
    await flush()

    expect(where()).toBe('/employees')
    expect(urls(fetchMock)).toEqual([
      '/api/employees',
      '/api/employees?name=%EC%97%86&status=UNAVAILABLE',
      '/api/employees',
    ])
    expect(screen.getByLabelText('이름 검색')).toHaveValue('')
    expect(screen.getByLabelText('투입 상태')).toHaveValue('')
    expect(names()).toEqual(['박소영', '최동훈', '이수민', '오승현'])
  })

  // Criterion 7.
  it('shows only the answer to the last search, even when an older answer arrives later', async () => {
    const held = deferred()
    const fetchMock = stubFetch((url) => {
      if (url === '/api/employees') return reply(200, ALL)
      if (url === '/api/employees?status=UNAVAILABLE') return held.promise
      return reply(200, [LEE])
    })
    await renderAt('/employees')

    await choose('투입 상태', 'UNAVAILABLE')
    expect(urls(fetchMock)).toContain('/api/employees?status=UNAVAILABLE')
    expect(held.isReleased()).toBe(false)

    await search('이')
    expect(urls(fetchMock).at(-1)).toBe('/api/employees?name=%EC%9D%B4&status=UNAVAILABLE')
    expect(names()).toEqual(['이수민'])

    await act(async () => {
      held.release(await reply(200, [CHOI]))
    })
    await flush()

    expect(held.isReleased()).toBe(true)
    expect(names()).toEqual(['이수민'])
  })

  it('shows only the last choice when a filter changes right after 다시 시도', async () => {
    const retry = deferred()
    let unavailable = 0
    stubFetch((url) => {
      if (url === '/api/employees') return reply(200, ALL)
      if (url === '/api/employees?status=UNAVAILABLE') {
        unavailable += 1
        return unavailable === 1 ? reply(500, { code: 'X', message: 'x' }) : retry.promise
      }
      return reply(200, [LEE])
    })
    await renderAt('/employees?status=UNAVAILABLE')
    fireEvent.click(within(screen.getByRole('alert')).getByRole('button', { name: '다시 시도' }))
    await flush()
    expect(unavailable).toBe(2)
    expect(retry.isReleased()).toBe(false)

    await choose('부서', '2')
    await act(async () => {
      retry.release(await reply(200, [CHOI]))
    })
    await flush()

    expect(names()).toEqual(['이수민'])
    expect(where()).toBe('/employees?departmentId=2&status=UNAVAILABLE')
  })

  // Criterion 8.
  it('names the number of chosen filters on the 필터 button, and the button opens and closes the filter area', async () => {
    stubFetch(() => reply(200, ALL))
    await renderAt('/employees')

    const toggle = screen.getByRole('button', { name: '필터' })
    const panel = document.getElementById(toggle.getAttribute('aria-controls') ?? '')
    expect(panel).not.toBeNull()
    expect(within(panel!).getByLabelText('부서')).toBeInTheDocument()
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(panel).not.toHaveAttribute('data-open')

    fireEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    expect(panel).toHaveAttribute('data-open')
    fireEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(panel).not.toHaveAttribute('data-open')

    await choose('투입 상태', 'UNAVAILABLE')
    await choose('기술', 'Java')
    expect(screen.getByRole('button', { name: '필터 (2)' })).toBe(toggle)
    await search('박')
    expect(screen.getByRole('button', { name: '필터 (2)' })).toBe(toggle)
  })
})

// T#39 criterion 4: "직원 등록" on the title row (BRIEF §6.3), for an HR manager only. The T#13 tests above render
// without a login state and so without this button. Hiding it below 1024px is CSS; the e2e of criterion 8 measures it.
describe('EmployeeListPage 직원 등록', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  async function renderAs(user: typeof HR_MANAGER) {
    render(
      <MemoryRouter initialEntries={['/employees']}>
        <AuthContext.Provider value={authAs(user)}>
          <EmployeeListPage />
          <Where />
        </AuthContext.Provider>
      </MemoryRouter>,
    )
    await flush()
  }

  for (const user of [HR_MANAGER, DUAL_MANAGER]) {
    it(`gives ${user.username} 직원 등록, which goes to /employees/new`, async () => {
      stubFetch(() => reply(200, ALL))

      await renderAs(user)

      fireEvent.click(screen.getByRole('button', { name: '직원 등록' }))
      await flush()
      expect(where()).toBe('/employees/new')
    })
  }

  it('gives project.manager no 직원 등록', async () => {
    stubFetch(() => reply(200, ALL))

    await renderAs(PROJECT_MANAGER)

    expect(screen.getByRole('cell', { name: '박소영' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '직원 등록' })).not.toBeInTheDocument()
  })
})
