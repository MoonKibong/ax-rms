import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ProjectSummary } from '../api/projects'
import { flush, reply } from '../test/api'
import ProjectListPage from './ProjectListPage'

// T#32 criterion 4: the "인력 부족" column of the project list (contract "화면 동작"). The value is the API's
// `understaffed` (D20, D36); the screen never works it out from the two headcounts.
const ALPHA: ProjectSummary = {
  id: 1,
  name: '알파 프로젝트',
  startDate: '2026-05-16',
  endDate: '2026-09-13',
  status: 'IN_PROGRESS',
  requiredHeadcount: 2,
  assignedHeadcount: 1,
  understaffed: true,
}

const BETA: ProjectSummary = {
  id: 3,
  name: '베타 프로젝트',
  startDate: '2026-05-26',
  endDate: '2026-08-14',
  status: 'IN_PROGRESS',
  requiredHeadcount: 2,
  assignedHeadcount: 3,
  understaffed: false,
}

// Fewer people than needed, yet the backend says it is not short (e.g. not in progress): no badge.
const GAMMA: ProjectSummary = {
  id: 2,
  name: '감마 프로젝트',
  startDate: '2025-10-08',
  endDate: '2026-03-07',
  status: 'DONE',
  requiredHeadcount: 5,
  assignedHeadcount: 0,
  understaffed: false,
}

async function renderList(projects: ProjectSummary[]) {
  vi.stubGlobal('fetch', vi.fn(() => reply(200, projects)))
  render(
    <MemoryRouter initialEntries={['/projects']}>
      <ProjectListPage />
    </MemoryRouter>,
  )
  await flush()
}

describe('ProjectListPage 인력 부족 column', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('has the column last, with a warning badge only where the API says understaffed', async () => {
    await renderList([ALPHA, BETA, GAMMA])

    expect(screen.getAllByRole('columnheader').map((th) => th.textContent)).toEqual([
      '프로젝트명',
      '상태',
      '기간',
      '필요 인원',
      '배치 인원',
      '인력 부족',
    ])
    const rows = screen.getAllByRole('row').slice(1)
    const alpha = within(rows[0]).getByText('인력 부족')
    expect(alpha).toHaveAttribute('data-status', 'UNDERSTAFFED')
    expect(within(rows[1]).queryByText('인력 부족')).not.toBeInTheDocument()
    expect(within(rows[2]).queryByText('인력 부족')).not.toBeInTheDocument()
    expect(screen.getAllByText('인력 부족', { selector: '[data-status]' })).toHaveLength(1)
    // The last cell of a row without the badge says "—".
    const cells = (row: HTMLElement) => within(row).getAllByRole('cell')
    expect(cells(rows[1])[5]).toHaveTextContent('—')
    expect(cells(rows[2])[5]).toHaveTextContent('—')
    expect(cells(rows[0])[5]).toHaveTextContent('인력 부족')
  })

  it('follows the API value, not the headcounts', async () => {
    // Needs 5 and has 0, but understaffed is false: no badge. Needs 2 and has 3, but understaffed is true: a badge.
    await renderList([GAMMA, { ...BETA, understaffed: true }])

    const rows = screen.getAllByRole('row').slice(1)
    expect(within(rows[0]).queryByText('인력 부족')).not.toBeInTheDocument()
    expect(within(rows[1]).getByText('인력 부족')).toHaveAttribute('data-status', 'UNDERSTAFFED')
  })
})
