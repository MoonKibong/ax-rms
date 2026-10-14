import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ProjectDetail } from '../api/projects'
import { AuthContext, type AuthState, type CurrentUser } from '../auth/AuthContext'
import { DUAL_MANAGER, HR_MANAGER, flush, never, reply } from '../test/api'
import ProjectDetailPage from './ProjectDetailPage'

// T#16 criteria 2-3: the project detail screen (contract "상세").
const PROJECT_MANAGER_ONLY: CurrentUser = {
  username: 'project.manager',
  employeeId: 4,
  employeeName: '정하늘',
  roles: ['EMPLOYEE', 'PROJECT_MANAGER'],
}

const ALPHA: ProjectDetail = {
  id: 1,
  name: '알파 프로젝트',
  description: '사내 포털 리뉴얼',
  startDate: '2026-05-16',
  endDate: '2026-09-13',
  status: 'IN_PROGRESS',
  requiredSkills: [
    { jobTitle: '백엔드 개발자', skillName: 'Java', proficiencyLevel: 'INTERMEDIATE', headcount: 2 },
    { jobTitle: '디자이너', skillName: 'Figma', proficiencyLevel: 'BEGINNER', headcount: 3 },
    { jobTitle: '아키텍트', skillName: 'AWS', proficiencyLevel: 'ADVANCED', headcount: 1 },
  ],
  requiredHeadcount: 5,
  assignedHeadcount: 3,
  assignments: [
    {
      assignmentId: 13,
      employeeId: 14,
      employeeName: '권지안',
      startDate: '2026-05-18',
      endDate: '2026-09-08',
      allocationPercent: 45,
      currentAvailability: 55,
    },
    {
      assignmentId: 7,
      employeeId: 6,
      employeeName: '강민재',
      startDate: '2026-05-21',
      endDate: '2026-09-03',
      allocationPercent: 40,
      currentAvailability: 60,
    },
  ],
}

function authAs(user: CurrentUser | null): AuthState {
  return { status: 'ready', user, signIn: () => undefined, logout: () => Promise.resolve(true), retry: () => undefined }
}

function stubFetch(handler: (url: string) => Promise<Response>) {
  const fetchMock = vi.fn((input: RequestInfo | URL) => handler(String(input)))
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

const urls = (fetchMock: ReturnType<typeof stubFetch>) => fetchMock.mock.calls.map(([input]) => String(input))

async function renderDetail(user: CurrentUser | null = DUAL_MANAGER, id = 1) {
  render(
    <AuthContext.Provider value={authAs(user)}>
      <MemoryRouter>
        <ProjectDetailPage id={id} />
      </MemoryRouter>
    </AuthContext.Provider>,
  )
  await flush()
}

describe('ProjectDetailPage', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('draws title, status, period, description, headcount, both tables and asks the API once', async () => {
    const fetchMock = stubFetch(() => reply(200, ALPHA))

    await renderDetail()

    expect(urls(fetchMock)).toEqual(['/api/projects/1'])
    expect(screen.getByRole('heading', { level: 1, name: '알파 프로젝트' })).toBeInTheDocument()
    expect(screen.getByText('진행 중')).toHaveAttribute('data-status', 'IN_PROGRESS')
    expect(screen.getByText('2026-05-16 ~ 2026-09-13')).toBeInTheDocument()
    expect(screen.getByText('사내 포털 리뉴얼')).toBeInTheDocument()
    expect(screen.getByText('필요 5명 / 배치 3명')).toBeInTheDocument()

    const skills = within(screen.getByRole('region', { name: '필요 역량' }))
    expect(skills.getAllByRole('columnheader').map((th) => th.textContent)).toEqual(['직무', '기술', '숙련도', '인원'])
    const skillRows = skills.getAllByRole('row').slice(1)
    expect(skillRows.map((row) => within(row).getAllByRole('cell').map((cell) => cell.textContent))).toEqual([
      ['백엔드 개발자', 'Java', '중급', '2'],
      ['디자이너', 'Figma', '초급', '3'],
      ['아키텍트', 'AWS', '고급', '1'],
    ])

    const assigned = within(screen.getByRole('region', { name: '배치 인력' }))
    expect(assigned.getAllByRole('columnheader').map((th) => th.textContent)).toEqual(['직원', '기간', '투입률'])
    const rows = assigned.getAllByRole('row').slice(1)
    expect(within(rows[0]).getByRole('link', { name: '권지안' })).toHaveAttribute('href', '/employees/14')
    expect(within(rows[0]).getAllByRole('cell').map((cell) => cell.textContent)).toEqual([
      '권지안',
      '2026-05-18 ~ 2026-09-08',
      '45%',
    ])
    expect(within(rows[1]).getByRole('link', { name: '강민재' })).toHaveAttribute('href', '/employees/6')
    expect(within(rows[1]).getAllByRole('cell')[2]).toHaveTextContent('40%')
  })

  it('shows — for a missing description and the empty states for no skills and no assignments', async () => {
    stubFetch(() =>
      reply(200, { ...ALPHA, description: null, requiredSkills: [], assignments: [], requiredHeadcount: 0, assignedHeadcount: 0 }),
    )

    await renderDetail()

    expect(screen.getByText('—')).toBeInTheDocument()
    expect(screen.getByText('필요 0명 / 배치 0명')).toBeInTheDocument()
    expect(screen.getByText('등록된 필요 역량이 없습니다')).toBeInTheDocument()
    expect(screen.getByText('배치된 직원이 없습니다')).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('does not draw 인력 부족 or the missing skills', async () => {
    stubFetch(() => reply(200, { ...ALPHA, assignedHeadcount: 1 }))

    await renderDetail()

    expect(screen.getByText('필요 5명 / 배치 1명')).toBeInTheDocument()
    expect(screen.queryByText(/인력 부족/)).not.toBeInTheDocument()
    expect(screen.queryByText(/부족한 역량/)).not.toBeInTheDocument()
  })

  it('says it is loading and marks the area busy until the answer arrives', async () => {
    stubFetch(() => never())

    await renderDetail()

    expect(screen.getByText('불러오는 중…').closest('[aria-busy="true"]')).not.toBeNull()
    expect(screen.queryByRole('heading', { level: 1 })).not.toBeInTheDocument()
  })

  it.each([
    ['a network error', () => Promise.reject(new TypeError('Failed to fetch'))],
    ['a 500 answer', () => reply(500, { code: 'X', message: 'x' })],
  ])('shows the error state for %s and 다시 시도 asks again', async (_label, failing) => {
    let attempt = 0
    const fetchMock = stubFetch(() => {
      attempt += 1
      return attempt === 1 ? failing() : reply(200, ALPHA)
    })

    await renderDetail()

    const alert = screen.getByRole('alert')
    expect(within(alert).getByText('데이터를 불러오지 못했습니다')).toBeInTheDocument()
    fireEvent.click(within(alert).getByRole('button', { name: '다시 시도' }))
    await flush()

    expect(urls(fetchMock)).toEqual(['/api/projects/1', '/api/projects/1'])
    expect(screen.getByRole('heading', { level: 1, name: '알파 프로젝트' })).toBeInTheDocument()
  })

  it('says the project cannot be found for a 404, with a link back to the list', async () => {
    stubFetch(() => reply(404, { code: 'PROJECT_NOT_FOUND', message: '프로젝트를 찾을 수 없습니다.' }))

    await renderDetail(DUAL_MANAGER, 99999)

    expect(screen.getByText('프로젝트를 찾을 수 없습니다')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '프로젝트 목록' })).toHaveAttribute('href', '/projects')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('draws the parts in the order of BRIEF 6.6, the button row last', async () => {
    stubFetch(() => reply(200, ALPHA))

    await renderDetail(DUAL_MANAGER)

    const parts = [
      screen.getByRole('heading', { level: 1, name: '알파 프로젝트' }),
      screen.getByText('사내 포털 리뉴얼'),
      screen.getByText('필요 5명 / 배치 3명'),
      screen.getByRole('region', { name: '필요 역량' }),
      screen.getByRole('region', { name: '배치 인력' }),
      screen.getByRole('link', { name: '인력 배치' }),
    ]
    for (let i = 1; i < parts.length; i += 1) {
      expect(
        parts[i - 1].compareDocumentPosition(parts[i]) & Node.DOCUMENT_POSITION_FOLLOWING,
        `part ${i + 1} follows part ${i}`,
      ).toBeTruthy()
    }
    expect(screen.getByRole('link', { name: '수정' }).compareDocumentPosition(screen.getByRole('region', { name: '배치 인력' })) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy()
  })

  it('gives a project manager 인력 배치 and 수정 as links', async () => {
    stubFetch(() => reply(200, ALPHA))

    await renderDetail(PROJECT_MANAGER_ONLY)

    expect(screen.getByRole('link', { name: '인력 배치' })).toHaveAttribute('href', '/projects/1/assign')
    expect(screen.getByRole('link', { name: '수정' })).toHaveAttribute('href', '/projects/1/edit')
  })

  it('gives an account with both manager roles the same two buttons', async () => {
    stubFetch(() => reply(200, ALPHA))

    await renderDetail(DUAL_MANAGER)

    expect(screen.getByRole('link', { name: '인력 배치' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '수정' })).toBeInTheDocument()
  })

  it('shows no write button to the HR manager, who reads only', async () => {
    stubFetch(() => reply(200, ALPHA))

    await renderDetail(HR_MANAGER)

    expect(screen.getByRole('heading', { level: 1, name: '알파 프로젝트' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: '인력 배치' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: '수정' })).not.toBeInTheDocument()
  })
})
