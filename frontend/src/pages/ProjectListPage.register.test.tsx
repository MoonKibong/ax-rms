import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AuthContext, type AuthState, type CurrentUser } from '../auth/AuthContext'
import { DUAL_MANAGER, HR_MANAGER, flush, reply } from '../test/api'
import ProjectListPage from './ProjectListPage'

// T#16 criterion 3 (PM memo on #15): the "프로젝트 등록" link in the list's title row is for project managers only.
const PROJECT_MANAGER_ONLY: CurrentUser = {
  username: 'project.manager',
  employeeId: 4,
  employeeName: '정하늘',
  roles: ['EMPLOYEE', 'PROJECT_MANAGER'],
}

function authAs(user: CurrentUser | null): AuthState {
  return { status: 'ready', user, signIn: () => undefined, logout: () => Promise.resolve(true), retry: () => undefined }
}

async function renderList(user: CurrentUser | null) {
  vi.stubGlobal('fetch', vi.fn(() => reply(200, [])))
  render(
    <AuthContext.Provider value={authAs(user)}>
      <MemoryRouter initialEntries={['/projects']}>
        <ProjectListPage />
      </MemoryRouter>
    </AuthContext.Provider>,
  )
  await flush()
}

describe('ProjectListPage 프로젝트 등록', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it.each([
    ['a project manager', PROJECT_MANAGER_ONLY],
    ['an account with both manager roles', DUAL_MANAGER],
  ])('has the link to /projects/new for %s, after the title', async (_label, user) => {
    await renderList(user)

    const link = screen.getByRole('link', { name: '프로젝트 등록' })
    expect(link).toHaveAttribute('href', '/projects/new')
    const heading = screen.getByRole('heading', { level: 1, name: '프로젝트' })
    expect(heading.compareDocumentPosition(link) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('has no such link for the HR manager', async () => {
    await renderList(HR_MANAGER)

    expect(screen.getByRole('heading', { level: 1, name: '프로젝트' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: '프로젝트 등록' })).not.toBeInTheDocument()
  })

  it('has no such link without a logged-in user', async () => {
    await renderList(null)

    expect(screen.queryByRole('link', { name: '프로젝트 등록' })).not.toBeInTheDocument()
  })
})
