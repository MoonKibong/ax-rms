import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ProjectSummary } from '../api/projects'
import { flush, never, reply } from '../test/api'
import ProjectListPage from './ProjectListPage'

// T#15 criteria 4-6: the project list screen (contract "화면 동작"). fetch is replaced; the router is a MemoryRouter.
function Where() {
  const location = useLocation()
  return <output data-testid="where">{location.pathname + location.search}</output>
}

const ALPHA: ProjectSummary = {
  id: 1,
  name: '알파 프로젝트',
  startDate: '2026-05-16',
  endDate: '2026-09-13',
  status: 'IN_PROGRESS',
  requiredHeadcount: 2,
  assignedHeadcount: 3,
}
const GAMMA: ProjectSummary = {
  id: 2,
  name: '감마 프로젝트',
  startDate: '2025-10-08',
  endDate: '2026-03-07',
  status: 'DONE',
  requiredHeadcount: 2,
  assignedHeadcount: 0,
}
const SHORT: ProjectSummary = {
  id: 3,
  name: '인력이 모자란 프로젝트',
  startDate: '2026-06-01',
  endDate: '2026-12-31',
  status: 'IN_PROGRESS',
  requiredHeadcount: 2,
  assignedHeadcount: 1,
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
      <ProjectListPage />
      <Where />
    </MemoryRouter>,
  )
  await flush()
}

const where = () => screen.getByTestId('where').textContent
const pressed = () =>
  within(screen.getByRole('group', { name: '상태 필터' }))
    .getAllByRole('button')
    .filter((button) => button.getAttribute('aria-pressed') === 'true')
    .map((button) => button.textContent)

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

describe('ProjectListPage', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('lists the projects as the API returned them, once, with links, badges and the period format', async () => {
    const fetchMock = stubFetch(() => reply(200, [ALPHA, GAMMA, SHORT]))

    await renderAt('/projects')

    expect(urls(fetchMock)).toEqual(['/api/projects'])
    expect(screen.getByRole('heading', { level: 1, name: '프로젝트' })).toBeInTheDocument()
    const rows = screen.getAllByRole('row').slice(1)
    expect(rows).toHaveLength(3)
    const alpha = within(rows[0])
    expect(alpha.getByRole('link', { name: '알파 프로젝트' })).toHaveAttribute('href', '/projects/1')
    expect(alpha.getByText('진행 중')).toHaveAttribute('data-status', 'IN_PROGRESS')
    expect(alpha.getAllByRole('cell').map((cell) => cell.textContent)).toEqual([
      '알파 프로젝트',
      '진행 중',
      '2026-05-16 ~ 2026-09-13',
      '2',
      '3',
    ])
    expect(within(rows[1]).getByText('완료')).toHaveAttribute('data-status', 'DONE')
    expect(within(rows[1]).getByRole('link', { name: '감마 프로젝트' })).toHaveAttribute('href', '/projects/2')
    expect(screen.getAllByRole('columnheader').map((th) => th.textContent)).toEqual([
      '프로젝트명',
      '상태',
      '기간',
      '필요 인원',
      '배치 인원',
    ])
  })

  it('does not draw 인력 부족 or 프로젝트 등록 (D20 is a backend rule; the register button is T#16)', async () => {
    stubFetch(() => reply(200, [SHORT]))

    await renderAt('/projects')

    expect(screen.getAllByRole('row')).toHaveLength(2)
    expect(screen.queryByText('인력 부족')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '프로젝트 등록' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: '프로젝트 등록' })).not.toBeInTheDocument()
  })

  it('has the five status buttons and requests the chosen status; 전체 asks without a query', async () => {
    const fetchMock = stubFetch(() => reply(200, [ALPHA]))
    await renderAt('/projects')
    expect(screen.getAllByRole('button').map((button) => button.textContent)).toEqual([
      '전체',
      '계획',
      '진행 중',
      '완료',
      '보류',
    ])
    expect(pressed()).toEqual(['전체'])

    fireEvent.click(screen.getByRole('button', { name: '진행 중' }))
    await flush()
    expect(urls(fetchMock)).toEqual(['/api/projects', '/api/projects?status=IN_PROGRESS'])
    expect(where()).toBe('/projects?status=IN_PROGRESS')
    expect(pressed()).toEqual(['진행 중'])

    fireEvent.click(screen.getByRole('button', { name: '전체' }))
    await flush()
    expect(urls(fetchMock)).toEqual(['/api/projects', '/api/projects?status=IN_PROGRESS', '/api/projects'])
    expect(where()).toBe('/projects')
    expect(pressed()).toEqual(['전체'])
  })

  it('starts from the status in the address, and treats an unknown status as 전체', async () => {
    const done = stubFetch(() => reply(200, [GAMMA]))
    await renderAt('/projects?status=DONE')
    expect(urls(done)).toEqual(['/api/projects?status=DONE'])
    expect(pressed()).toEqual(['완료'])
    expect(screen.getByRole('link', { name: '감마 프로젝트' })).toBeInTheDocument()
  })

  it('treats an unknown status as 전체', async () => {
    const fetchMock = stubFetch(() => reply(200, [ALPHA]))

    await renderAt('/projects?status=bogus')

    expect(urls(fetchMock)).toEqual(['/api/projects'])
    expect(pressed()).toEqual(['전체'])
  })

  it('does not send another request when the chosen button is pressed again', async () => {
    const fetchMock = stubFetch(() => reply(200, [ALPHA]))
    await renderAt('/projects?status=DONE')

    fireEvent.click(screen.getByRole('button', { name: '완료' }))
    await flush()

    expect(urls(fetchMock)).toEqual(['/api/projects?status=DONE'])
  })

  it('says it is loading and marks the area busy until the answer arrives', async () => {
    stubFetch(() => never())

    await renderAt('/projects')

    expect(screen.getByText('불러오는 중…')).toBeInTheDocument()
    expect(screen.getByText('불러오는 중…').closest('[aria-busy="true"]')).not.toBeNull()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it.each([
    ['a network error', () => Promise.reject(new TypeError('Failed to fetch'))],
    ['a 500 answer', () => reply(500, { code: 'X', message: 'x' })],
    ['a 401 answer', () => reply(401, { code: 'AUTH_REQUIRED', message: '로그인이 필요합니다.' })],
  ])('shows the error state for %s and 다시 시도 asks again', async (_label, failing) => {
    let attempt = 0
    const fetchMock = stubFetch(() => {
      attempt += 1
      return attempt === 1 ? failing() : reply(200, [ALPHA])
    })

    await renderAt('/projects?status=IN_PROGRESS')

    const alert = screen.getByRole('alert')
    expect(within(alert).getByText('데이터를 불러오지 못했습니다')).toBeInTheDocument()
    fireEvent.click(within(alert).getByRole('button', { name: '다시 시도' }))
    await flush()

    expect(urls(fetchMock)).toEqual(['/api/projects?status=IN_PROGRESS', '/api/projects?status=IN_PROGRESS'])
    expect(screen.getByRole('link', { name: '알파 프로젝트' })).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('shows the empty state for no projects at all', async () => {
    stubFetch(() => reply(200, []))

    await renderAt('/projects')

    expect(screen.getByText('등록된 프로젝트가 없습니다')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '필터 초기화' })).not.toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('shows no-results for an empty filtered answer, and 필터 초기화 goes back to 전체', async () => {
    const fetchMock = stubFetch((url) => reply(200, url.includes('status=') ? [] : [ALPHA]))
    await renderAt('/projects?status=PLANNED')

    expect(screen.getByText('이 상태의 프로젝트가 없습니다')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '필터 초기화' }))
    await flush()

    expect(urls(fetchMock)).toEqual(['/api/projects?status=PLANNED', '/api/projects'])
    expect(pressed()).toEqual(['전체'])
    expect(where()).toBe('/projects')
    expect(screen.getByRole('link', { name: '알파 프로젝트' })).toBeInTheDocument()
  })

  it('shows only the answer to the last chosen filter, even when an older answer arrives later', async () => {
    const inProgress = deferred()
    const done = deferred()
    const fetchMock = stubFetch((url) => {
      if (url.endsWith('status=IN_PROGRESS')) return inProgress.promise
      if (url.endsWith('status=DONE')) return done.promise
      return reply(200, [])
    })
    await renderAt('/projects')

    fireEvent.click(screen.getByRole('button', { name: '진행 중' }))
    await flush()
    expect(urls(fetchMock)).toContain('/api/projects?status=IN_PROGRESS')
    expect(inProgress.isReleased()).toBe(false)

    fireEvent.click(screen.getByRole('button', { name: '완료' }))
    await flush()
    await act(async () => {
      done.release(await reply(200, [GAMMA]))
    })
    await flush()
    expect(screen.getByRole('link', { name: '감마 프로젝트' })).toBeInTheDocument()

    await act(async () => {
      inProgress.release(await reply(200, [ALPHA]))
    })
    await flush()

    expect(inProgress.isReleased()).toBe(true)
    expect(screen.queryByRole('link', { name: '알파 프로젝트' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: '감마 프로젝트' })).toBeInTheDocument()
    expect(pressed()).toEqual(['완료'])
  })

  it('shows only the last choice when the filter changes right after 다시 시도', async () => {
    const retry = deferred()
    let call = 0
    stubFetch((url) => {
      call += 1
      if (call === 1) return reply(500, { code: 'X', message: 'x' })
      if (url.endsWith('status=DONE')) return reply(200, [GAMMA])
      return retry.promise
    })
    await renderAt('/projects')
    fireEvent.click(within(screen.getByRole('alert')).getByRole('button', { name: '다시 시도' }))
    await flush()
    expect(retry.isReleased()).toBe(false)

    fireEvent.click(screen.getByRole('button', { name: '완료' }))
    await flush()
    await act(async () => {
      retry.release(await reply(200, [ALPHA]))
    })
    await flush()

    expect(screen.queryByRole('link', { name: '알파 프로젝트' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: '감마 프로젝트' })).toBeInTheDocument()
  })
})
