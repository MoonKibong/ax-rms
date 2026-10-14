import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Candidate } from '../api/assignments'
import type { EmployeeDetail, EmployeeListItem } from '../api/employees'
import type { ProjectDetail } from '../api/projects'
import { flush, never, reply } from '../test/api'
import ProjectAssignPage from './ProjectAssignPage'

// T#17 criteria 2-6: the assignment screen (contract "화면 동작"). A fake fetch answers by address and method; the page
// is rendered without a router role guard (the route guard is criterion 1, AppRoutes.assign.test.tsx).
const PROJECT: ProjectDetail = {
  id: 3,
  name: '베타 프로젝트',
  description: '모바일 앱 개편',
  startDate: '2026-05-16',
  endDate: '2026-09-13',
  status: 'IN_PROGRESS',
  requiredSkills: [],
  requiredHeadcount: 2,
  assignedHeadcount: 1,
  assignments: [
    {
      assignmentId: 21,
      employeeId: 1,
      employeeName: '박소영',
      startDate: '2026-05-20',
      endDate: '2026-08-30',
      allocationPercent: 30,
      currentAvailability: 10,
    },
  ],
}

const EMPLOYEES: EmployeeListItem[] = [
  {
    id: 1,
    name: '박소영',
    departmentId: 1,
    departmentName: '개발팀',
    jobTitle: '백엔드 개발자',
    careerYears: 5,
    availabilityStatus: 'AVAILABLE',
    currentAvailability: 10,
    needsReview: false,
    skills: [
      { skillName: 'Java', proficiencyLevel: 'INTERMEDIATE' },
      { skillName: 'React', proficiencyLevel: 'BEGINNER' },
    ],
  },
  {
    id: 2,
    name: '최동훈',
    departmentId: 1,
    departmentName: '개발팀',
    jobTitle: '프런트엔드 개발자',
    careerYears: 3,
    availabilityStatus: 'UNAVAILABLE',
    currentAvailability: 60,
    needsReview: true,
    skills: [],
  },
  {
    id: 3,
    name: '이수민',
    departmentId: 2,
    departmentName: '기획팀',
    jobTitle: '인사 담당',
    careerYears: 7,
    availabilityStatus: 'AVAILABLE',
    currentAvailability: 100,
    needsReview: false,
    skills: [{ skillName: '기획', proficiencyLevel: 'ADVANCED' }],
  },
]

const CANDIDATES: Candidate[] = [
  { employeeId: 1, name: '박소영', availabilityStatus: 'AVAILABLE', periodAvailability: 40 },
  { employeeId: 2, name: '최동훈', availabilityStatus: 'UNAVAILABLE', periodAvailability: 60 },
  { employeeId: 3, name: '이수민', availabilityStatus: 'AVAILABLE', periodAvailability: 100 },
]

function detailOf(id: number): EmployeeDetail {
  const employee = EMPLOYEES.find((item) => item.id === id)!
  return {
    id,
    name: employee.name,
    departmentId: employee.departmentId,
    departmentName: employee.departmentName,
    jobTitle: employee.jobTitle,
    careerYears: employee.careerYears,
    availabilityStatus: employee.availabilityStatus,
    unavailableReason: null,
    unavailableUntil: null,
    currentAvailability: employee.currentAvailability,
    needsReview: employee.needsReview,
    skills: employee.skills,
    assignments: [
      {
        projectId: 1,
        projectName: '알파 프로젝트',
        projectStatus: 'IN_PROGRESS',
        startDate: '2026-05-18',
        endDate: '2026-09-08',
        allocationPercent: 60,
      },
    ],
    today: '2026-06-15',
  }
}

const CANDIDATE_URL = '/api/assignments/candidates?projectId=3&startDate=2026-05-16&endDate=2026-09-13'

type Call = { url: string; method: string; body: string | undefined; signal: AbortSignal | undefined }
type Handler = (call: Call) => Promise<Response> | undefined

// Answers every address with its fixture; `handler` may answer first (return undefined to fall through).
function stubApi(handler: Handler = () => undefined) {
  const calls: Call[] = []
  const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const call: Call = {
      url: String(input),
      method: init?.method ?? 'GET',
      body: typeof init?.body === 'string' ? init.body : undefined,
      signal: init?.signal ?? undefined,
    }
    calls.push(call)
    const own = handler(call)
    if (own) return own
    if (call.method !== 'GET') return reply(500, { code: 'UNEXPECTED', message: 'unexpected write' })
    if (call.url === '/api/projects/3') return reply(200, PROJECT)
    if (call.url.startsWith('/api/assignments/candidates')) return reply(200, CANDIDATES)
    if (call.url === '/api/employees') return reply(200, EMPLOYEES)
    const detail = /^\/api\/employees\/(\d+)$/.exec(call.url)
    if (detail) return reply(200, detailOf(Number(detail[1])))
    return reply(404, { code: 'NOT_FOUND', message: 'x' })
  })
  vi.stubGlobal('fetch', fetchMock)
  return calls
}

const writes = (calls: Call[]) => calls.filter((call) => call.method !== 'GET')
const gets = (calls: Call[], prefix: string) => calls.filter((call) => call.method === 'GET' && call.url.startsWith(prefix))

async function renderPage(id = 3) {
  render(
    <MemoryRouter>
      <ProjectAssignPage id={id} />
    </MemoryRouter>,
  )
  await flush()
}

const candidates = () => within(screen.getByRole('region', { name: '후보 직원' }))
const current = () => within(screen.getByRole('region', { name: '현재 배치' }))
const percentInput = () => screen.getByLabelText('투입률(%)')
const startInput = () => screen.getByLabelText('시작일')
const endInput = () => screen.getByLabelText('종료일')
const pick = async (name: string) => {
  fireEvent.click(candidates().getByRole('button', { name }))
  await flush()
}
const describedBy = (input: HTMLElement) => document.getElementById(input.getAttribute('aria-describedby') ?? '')?.textContent ?? null

describe('ProjectAssignPage view', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('draws the six parts of BRIEF 6.7 in order, with the first requests', async () => {
    const calls = stubApi()

    await renderPage()

    expect(calls.map((call) => call.url).sort()).toEqual(['/api/employees', '/api/projects/3', CANDIDATE_URL].sort())
    const parts = [
      screen.getByRole('heading', { level: 1, name: '베타 프로젝트' }),
      screen.getByText('2026-05-16 ~ 2026-09-13'),
      screen.getByRole('link', { name: '프로젝트 상세' }),
      screen.getByRole('group', { name: '배치 기간' }),
      screen.getByRole('region', { name: '후보 직원' }),
      screen.getByRole('region', { name: '선택한 직원 일정' }),
      screen.getByRole('region', { name: '배치 입력' }),
      screen.getByRole('region', { name: '현재 배치' }),
    ]
    for (let i = 1; i < parts.length; i += 1) {
      expect(parts[i - 1].compareDocumentPosition(parts[i]) & Node.DOCUMENT_POSITION_FOLLOWING, `part ${i + 1} follows part ${i}`).toBeTruthy()
    }
    expect(screen.getByRole('link', { name: '프로젝트 상세' })).toHaveAttribute('href', '/projects/3')
    expect(startInput()).toHaveValue('2026-05-16')
    expect(endInput()).toHaveValue('2026-09-13')
  })

  it('draws the candidate table with department, skills, status and the period availability', async () => {
    stubApi()

    await renderPage()

    const table = candidates()
    expect(table.getAllByRole('columnheader').map((th) => th.textContent)).toEqual(['이름', '부서', '기술', '상태', '기간 가용률'])
    const rows = table.getAllByRole('row').slice(1)
    expect(rows.map((row) => within(row).getAllByRole('cell').map((cell) => cell.textContent))).toEqual([
      ['박소영', '개발팀', 'Java 중급, React 초급', '투입 가능', '40%'],
      ['최동훈', '개발팀', '', '투입 불가', '60%'],
      ['이수민', '기획팀', '기획 고급', '투입 가능', '100%'],
    ])
    for (const name of ['박소영', '최동훈', '이수민']) {
      expect(table.getByRole('button', { name })).toHaveAttribute('aria-pressed', 'false')
    }
    expect(screen.getByText('직원을 선택하면 일정이 보입니다')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '배치' })).toBeDisabled()
  })

  it('shows the schedule of a picked employee, asking for the detail once', async () => {
    const calls = stubApi()
    await renderPage()

    await pick('박소영')

    expect(candidates().getByRole('button', { name: '박소영' })).toHaveAttribute('aria-pressed', 'true')
    expect(gets(calls, '/api/employees/1').map((call) => call.url)).toEqual(['/api/employees/1'])
    const schedule = within(screen.getByRole('region', { name: '선택한 직원 일정' }))
    expect(schedule.getByRole('img', { name: /알파 프로젝트/ })).toBeInTheDocument()
    expect(screen.queryByText('직원을 선택하면 일정이 보입니다')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '배치' })).toBeEnabled()
  })

  it('draws the current assignments with a link, the percent and the two buttons', async () => {
    stubApi()

    await renderPage()

    const rows = current().getAllByRole('row').slice(1)
    expect(rows).toHaveLength(1)
    expect(within(rows[0]).getByRole('link', { name: '박소영' })).toHaveAttribute('href', '/employees/1')
    expect(within(rows[0]).getAllByRole('cell').slice(0, 3).map((cell) => cell.textContent)).toEqual([
      '박소영',
      '2026-05-20 ~ 2026-08-30',
      '30%',
    ])
    expect(within(rows[0]).getByRole('button', { name: '수정' })).toBeInTheDocument()
    expect(within(rows[0]).getByRole('button', { name: '해제' })).toBeInTheDocument()
  })

  it('asks for the candidates again with the new period when a date changes', async () => {
    const calls = stubApi()
    await renderPage()

    fireEvent.change(startInput(), { target: { value: '2026-06-01' } })
    await flush()

    expect(gets(calls, '/api/assignments/candidates').map((call) => call.url)).toEqual([
      CANDIDATE_URL,
      '/api/assignments/candidates?projectId=3&startDate=2026-06-01&endDate=2026-09-13',
    ])
  })
})

describe('ProjectAssignPage assigning', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('does not send a percent that is not 5 to 100 in steps of 5 and says why under the percent', async () => {
    const calls = stubApi()
    await renderPage()
    await pick('이수민')

    for (const value of ['', '33', '0', '105', '12.5']) {
      fireEvent.change(percentInput(), { target: { value } })
      fireEvent.click(screen.getByRole('button', { name: '배치' }))
      await flush()
      expect(percentInput(), `percent "${value}"`).toHaveAttribute('aria-invalid', 'true')
      expect(describedBy(percentInput())).toBe('투입률은 5~100의 5 단위로 입력하세요.')
    }
    expect(writes(calls)).toEqual([])
  })

  it('does not send a reversed or empty period and says why under the end date', async () => {
    const calls = stubApi()
    await renderPage()
    await pick('이수민')
    fireEvent.change(percentInput(), { target: { value: '30' } })

    fireEvent.change(startInput(), { target: { value: '2026-10-01' } })
    fireEvent.click(screen.getByRole('button', { name: '배치' }))
    await flush()
    expect(describedBy(endInput())).toBe('시작일은 종료일보다 늦을 수 없습니다.')

    fireEvent.change(startInput(), { target: { value: '' } })
    fireEvent.click(screen.getByRole('button', { name: '배치' }))
    await flush()
    expect(describedBy(endInput())).toBe('시작일과 종료일을 입력하세요.')
    expect(writes(calls)).toEqual([])
  })

  it('posts the assignment once, empties the form and asks for project, candidates and schedule again', async () => {
    let release: (response: Response) => void = () => undefined
    const calls = stubApi((call) =>
      call.method === 'POST' ? new Promise<Response>((resolve) => { release = resolve }) : undefined,
    )
    await renderPage()
    await pick('이수민')
    fireEvent.change(percentInput(), { target: { value: '30' } })

    fireEvent.click(screen.getByRole('button', { name: '배치' }))
    fireEvent.click(screen.getByRole('button', { name: '배치' }))
    await flush()

    expect(writes(calls).map((call) => [call.method, call.url])).toEqual([['POST', '/api/assignments']])
    expect(JSON.parse(writes(calls)[0].body!)).toEqual({
      employeeId: 3,
      projectId: 3,
      startDate: '2026-05-16',
      endDate: '2026-09-13',
      allocationPercent: 30,
    })
    expect(screen.getByRole('button', { name: '배치' })).toHaveAttribute('aria-busy', 'true')

    release(await reply(201, { id: 30, employeeId: 3, projectId: 3, startDate: '2026-05-16', endDate: '2026-09-13', allocationPercent: 30 }))
    await flush()

    expect(percentInput()).toHaveValue(null)
    expect(gets(calls, '/api/projects/3')).toHaveLength(2)
    expect(gets(calls, '/api/assignments/candidates')).toHaveLength(2)
    expect(gets(calls, '/api/employees/3')).toHaveLength(2)
  })

  it.each([
    ['ASSIGNMENT_INVALID_PERCENT', '투입률은 5~100의 5 단위로 입력하세요.', 'percent'],
    ['ASSIGNMENT_OVER_ALLOCATED', '대상 기간에 투입률 합계가 100%를 초과합니다.', 'percent'],
    ['ASSIGNMENT_OUT_OF_PROJECT_PERIOD', '배치 기간은 프로젝트 기간 안에 있어야 합니다.', 'period'],
    ['ASSIGNMENT_REQUEST_INVALID', '시작일은 종료일보다 늦을 수 없습니다.', 'period'],
    ['ASSIGNMENT_EMPLOYEE_UNAVAILABLE', '투입 불가 직원은 새 배치를 받을 수 없습니다.', 'form'],
    ['ASSIGNMENT_NO_AVAILABILITY', '대상 기간에 가용률이 0%입니다.', 'form'],
    ['ASSIGNMENT_OVERLAP', '같은 프로젝트에 기간이 겹치는 배치가 있습니다.', 'form'],
    ['ASSIGNMENT_NOT_FOUND', '배치를 찾을 수 없습니다.', 'form'],
  ])('puts the message of %s where its cause is', async (code, message, place) => {
    stubApi((call) => (call.method === 'POST' ? reply(code === 'ASSIGNMENT_NOT_FOUND' ? 404 : 400, { code, message }) : undefined))
    await renderPage()
    await pick('이수민')
    fireEvent.change(percentInput(), { target: { value: '30' } })

    fireEvent.click(screen.getByRole('button', { name: '배치' }))
    await flush()

    if (place === 'percent') {
      expect(percentInput()).toHaveAttribute('aria-invalid', 'true')
      expect(describedBy(percentInput())).toBe(message)
    } else if (place === 'period') {
      expect(endInput()).toHaveAttribute('aria-invalid', 'true')
      expect(describedBy(endInput())).toBe(message)
    } else {
      const alert = screen.getByRole('alert')
      expect(alert).toHaveTextContent(message)
      // Above the 배치 button.
      expect(alert.compareDocumentPosition(screen.getByRole('button', { name: '배치' })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
      expect(percentInput()).not.toHaveAttribute('aria-invalid')
    }
    // Nothing is cleared: the person corrects the input.
    expect(percentInput()).toHaveValue(30)
  })

  it('clears the message of an input when its value changes', async () => {
    stubApi((call) => (call.method === 'POST' ? reply(400, { code: 'ASSIGNMENT_OVER_ALLOCATED', message: '합계가 100%를 초과합니다.' }) : undefined))
    await renderPage()
    await pick('이수민')
    fireEvent.change(percentInput(), { target: { value: '30' } })
    fireEvent.click(screen.getByRole('button', { name: '배치' }))
    await flush()
    expect(percentInput()).toHaveAttribute('aria-invalid', 'true')

    fireEvent.change(percentInput(), { target: { value: '25' } })

    expect(percentInput()).not.toHaveAttribute('aria-invalid')
  })

  it.each([
    ['a network error', () => Promise.reject(new TypeError('Failed to fetch'))],
    ['an answer that is not {code, message}', () => reply(500, 'oops')],
  ])('says the save failed above the button for %s and keeps the input', async (_label, failing) => {
    stubApi((call) => (call.method === 'POST' ? failing() : undefined))
    await renderPage()
    await pick('이수민')
    fireEvent.change(percentInput(), { target: { value: '30' } })

    fireEvent.click(screen.getByRole('button', { name: '배치' }))
    await flush()

    expect(screen.getByRole('alert')).toHaveTextContent('저장하지 못했습니다. 잠시 후 다시 시도하세요.')
    expect(percentInput()).toHaveValue(30)
    expect(screen.getByRole('button', { name: '배치' })).not.toHaveAttribute('aria-busy')
  })
})

describe('ProjectAssignPage modifying', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  async function startEdit() {
    fireEvent.click(within(current().getAllByRole('row')[1]).getByRole('button', { name: '수정' }))
    await flush()
  }

  it('fills the form from the row, names the target and swaps the buttons', async () => {
    stubApi()
    await renderPage()

    await startEdit()

    expect(screen.getByRole('region', { name: '박소영 배치 수정' })).toBeInTheDocument()
    expect(percentInput()).toHaveValue(30)
    expect(startInput()).toHaveValue('2026-05-20')
    expect(endInput()).toHaveValue('2026-08-30')
    expect(screen.getByRole('button', { name: '수정 저장' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '취소' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '배치' })).not.toBeInTheDocument()
    // The target is the row's, so the other names cannot be picked meanwhile.
    expect(candidates().getByRole('button', { name: '이수민' })).toBeDisabled()
  })

  it('patches only the changed value, asks again and leaves the edit mode', async () => {
    const calls = stubApi((call) => (call.method === 'PATCH' ? reply(200, { id: 21 }) : undefined))
    await renderPage()
    await startEdit()

    fireEvent.change(percentInput(), { target: { value: '40' } })
    fireEvent.click(screen.getByRole('button', { name: '수정 저장' }))
    await flush()

    expect(writes(calls).map((call) => [call.method, call.url, call.body])).toEqual([
      ['PATCH', '/api/assignments/21', JSON.stringify({ allocationPercent: 40 })],
    ])
    expect(gets(calls, '/api/projects/3')).toHaveLength(2)
    expect(screen.getByRole('button', { name: '배치' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '수정 저장' })).not.toBeInTheDocument()
  })

  it('shows the forbidden-for-unavailable cause above the button and stays in the edit mode', async () => {
    stubApi((call) =>
      call.method === 'PATCH'
        ? reply(400, { code: 'ASSIGNMENT_MODIFY_FORBIDDEN_UNAVAILABLE', message: '투입 불가 직원은 투입률을 높일 수 없습니다.' })
        : undefined,
    )
    await renderPage()
    await startEdit()
    fireEvent.change(percentInput(), { target: { value: '45' } })

    fireEvent.click(screen.getByRole('button', { name: '수정 저장' }))
    await flush()

    expect(screen.getByRole('alert')).toHaveTextContent('투입 불가 직원은 투입률을 높일 수 없습니다.')
    expect(screen.getByRole('button', { name: '수정 저장' })).toBeInTheDocument()
  })

  it('goes back to assigning with an empty form on 취소, without a request', async () => {
    const calls = stubApi()
    await renderPage()
    await startEdit()

    fireEvent.click(screen.getByRole('button', { name: '취소' }))

    expect(writes(calls)).toEqual([])
    expect(screen.getByRole('button', { name: '배치' })).toBeInTheDocument()
    expect(percentInput()).toHaveValue(null)
  })
})

describe('ProjectAssignPage releasing', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  const release = () => within(current().getAllByRole('row')[1]).getByRole('button', { name: '해제' })
  const dialog = () => screen.getByRole('dialog', { name: '배치 해제' })

  it('asks in a dialog that names the assignment, and 취소 closes it without a request', async () => {
    const calls = stubApi()
    await renderPage()

    fireEvent.click(release())

    expect(within(dialog()).getByText('박소영 · 베타 프로젝트 · 2026-05-20 ~ 2026-08-30 · 30%')).toBeInTheDocument()
    fireEvent.click(within(dialog()).getByRole('button', { name: '취소' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(writes(calls)).toEqual([])
  })

  it('deletes once, closes the dialog and asks for the project and candidates again', async () => {
    let finish: (response: Response) => void = () => undefined
    const calls = stubApi((call) =>
      call.method === 'DELETE' ? new Promise<Response>((resolve) => { finish = resolve }) : undefined,
    )
    await renderPage()
    fireEvent.click(release())

    fireEvent.click(within(dialog()).getByRole('button', { name: '해제' }))
    fireEvent.click(within(dialog()).getByRole('button', { name: '해제' }))
    await flush()

    expect(writes(calls).map((call) => [call.method, call.url])).toEqual([['DELETE', '/api/assignments/21']])
    expect(within(dialog()).getByRole('button', { name: '해제' })).toHaveAttribute('aria-busy', 'true')
    // Escape does not close it while the request is under way.
    fireEvent.keyDown(dialog(), { key: 'Escape' })
    expect(dialog()).toBeInTheDocument()

    finish(await reply(204, null))
    await flush()

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(gets(calls, '/api/projects/3')).toHaveLength(2)
    expect(gets(calls, '/api/assignments/candidates')).toHaveLength(2)
  })

  it('keeps the dialog open and shows the server message when the release fails', async () => {
    stubApi((call) => (call.method === 'DELETE' ? reply(404, { code: 'ASSIGNMENT_NOT_FOUND', message: '배치를 찾을 수 없습니다.' }) : undefined))
    await renderPage()
    fireEvent.click(release())

    fireEvent.click(within(dialog()).getByRole('button', { name: '해제' }))
    await flush()

    expect(within(dialog()).getByRole('alert')).toHaveTextContent('배치를 찾을 수 없습니다.')
    expect(within(dialog()).getByRole('button', { name: '해제' })).not.toHaveAttribute('aria-busy')
  })
})

describe('ProjectAssignPage states', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('says it is loading and marks the area busy until the project arrives', async () => {
    stubApi((call) => (call.url === '/api/projects/3' ? never() : undefined))

    await renderPage()

    expect(screen.getByText('불러오는 중…').closest('[aria-busy="true"]')).not.toBeNull()
    expect(screen.queryByRole('heading', { level: 1 })).not.toBeInTheDocument()
  })

  it('shows the error state when the project fails and 다시 시도 asks again', async () => {
    let attempt = 0
    const calls = stubApi((call) => {
      if (call.url === '/api/projects/3') {
        attempt += 1
        return attempt === 1 ? reply(500, { code: 'X', message: 'x' }) : undefined
      }
      return undefined
    })
    await renderPage()

    const alert = screen.getByRole('alert')
    expect(within(alert).getByText('데이터를 불러오지 못했습니다')).toBeInTheDocument()
    fireEvent.click(within(alert).getByRole('button', { name: '다시 시도' }))
    await flush()

    expect(gets(calls, '/api/projects/3')).toHaveLength(2)
    expect(screen.getByRole('heading', { level: 1, name: '베타 프로젝트' })).toBeInTheDocument()
  })

  it('says the project cannot be found for a 404, with a link to the list', async () => {
    stubApi((call) => (call.url === '/api/projects/3' ? reply(404, { code: 'PROJECT_NOT_FOUND', message: 'x' }) : undefined))

    await renderPage()

    expect(screen.getByText('프로젝트를 찾을 수 없습니다')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '프로젝트 목록' })).toHaveAttribute('href', '/projects')
  })

  it('gives the candidate table its own error state with a retry', async () => {
    let attempt = 0
    const calls = stubApi((call) => {
      if (call.url.startsWith('/api/assignments/candidates')) {
        attempt += 1
        return attempt === 1 ? reply(500, { code: 'X', message: 'x' }) : undefined
      }
      return undefined
    })
    await renderPage()

    const region = candidates()
    expect(region.getByText('데이터를 불러오지 못했습니다')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: '베타 프로젝트' })).toBeInTheDocument()
    fireEvent.click(region.getByRole('button', { name: '다시 시도' }))
    await flush()

    expect(gets(calls, '/api/assignments/candidates')).toHaveLength(2)
    expect(candidates().getByRole('button', { name: '박소영' })).toBeInTheDocument()
  })

  it('shows the empty state when there are no candidates and the other parts stay', async () => {
    stubApi((call) => (call.url.startsWith('/api/assignments/candidates') ? reply(200, []) : undefined))

    await renderPage()

    expect(candidates().getByText('이 기간에 투입 가능한 직원이 없습니다')).toBeInTheDocument()
    expect(screen.getByRole('region', { name: '현재 배치' })).toBeInTheDocument()
  })

  it('filters the candidates by name, shows no-results with 필터 초기화', async () => {
    stubApi()
    await renderPage()

    fireEvent.change(screen.getByLabelText('이름 검색'), { target: { value: '소영' } })
    expect(candidates().getAllByRole('row').slice(1)).toHaveLength(1)
    expect(candidates().getByRole('button', { name: '박소영' })).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('이름 검색'), { target: { value: '없는이름' } })
    expect(candidates().getByText('검색 결과가 없습니다')).toBeInTheDocument()
    fireEvent.click(candidates().getByRole('button', { name: '필터 초기화' }))
    expect(candidates().getAllByRole('row').slice(1)).toHaveLength(3)
  })

  it('shows the empty state for no current assignment', async () => {
    stubApi((call) => (call.url === '/api/projects/3' ? reply(200, { ...PROJECT, assignments: [] }) : undefined))

    await renderPage()

    expect(current().getByText('배치된 직원이 없습니다')).toBeInTheDocument()
    expect(current().queryByRole('table')).not.toBeInTheDocument()
  })

  it('ignores a late answer for an older period', async () => {
    const answers: Array<(response: Response) => void> = []
    stubApi((call) => {
      if (call.url.startsWith('/api/assignments/candidates') && answers.length < 2 && call.url !== CANDIDATE_URL) {
        return new Promise<Response>((resolve) => answers.push(resolve))
      }
      return undefined
    })
    await renderPage()

    fireEvent.change(startInput(), { target: { value: '2026-06-01' } })
    fireEvent.change(startInput(), { target: { value: '2026-07-01' } })
    await flush()
    // The newer answer arrives first, the older one after it.
    answers[1](await reply(200, [{ employeeId: 3, name: '이수민', availabilityStatus: 'AVAILABLE', periodAvailability: 90 }]))
    await flush()
    answers[0](await reply(200, CANDIDATES))
    await flush()

    expect(candidates().getAllByRole('row').slice(1)).toHaveLength(1)
    expect(candidates().getByRole('button', { name: '이수민' })).toBeInTheDocument()
  })

  it('cancels the schedule request of the employee picked before when another one is picked', async () => {
    const calls = stubApi((call) => (call.url === '/api/employees/1' ? never() : undefined))
    await renderPage()

    await pick('박소영')
    const first = gets(calls, '/api/employees/1')[0]
    expect(first.signal?.aborted).toBe(false)
    await pick('이수민')

    expect(first.signal?.aborted).toBe(true)
    expect(candidates().getByRole('button', { name: '이수민' })).toHaveAttribute('aria-pressed', 'true')
  })
})
