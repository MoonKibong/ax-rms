import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import AppShell from './AppShell'

describe('AppShell', () => {
  it('draws the banner, navigation, and main landmarks around the page', () => {
    render(
      <AppShell current="dashboard">
        <p>본문</p>
      </AppShell>,
    )

    expect(screen.queryByRole('navigation')).toBeInTheDocument()
    expect(screen.queryByRole('banner')).toBeInTheDocument()
    expect(screen.queryByRole('main')).toBeInTheDocument()
    expect(within(screen.getByRole('main')).getByText('본문')).toBeInTheDocument()
  })

  it('links the BRIEF navigation items and marks the current one', () => {
    render(
      <AppShell current="employees">
        <p>본문</p>
      </AppShell>,
    )

    const links = within(screen.getByRole('navigation')).getAllByRole('link')
    expect(links.map((link) => link.textContent)).toEqual(['대시보드', '직원', '프로젝트'])
    expect(links.map((link) => link.getAttribute('href'))).toEqual(['/', '/employees', '/projects'])
    expect(links.map((link) => link.getAttribute('aria-current'))).toEqual([null, 'page', null])
  })
})
