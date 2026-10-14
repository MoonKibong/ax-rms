import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import ButtonLink from './ButtonLink'

// T#16 criterion 1(a): a link that looks like a Button (BRIEF §3.1).
describe('ButtonLink', () => {
  it('is a link to the given address, drawn as a primary button by default', () => {
    render(
      <MemoryRouter>
        <ButtonLink to="/projects/new">프로젝트 등록</ButtonLink>
      </MemoryRouter>,
    )

    const link = screen.getByRole('link', { name: '프로젝트 등록' })
    expect(link).toHaveAttribute('href', '/projects/new')
    expect(link).toHaveClass('button')
    expect(link).toHaveAttribute('data-variant', 'primary')
  })

  it('draws the secondary variant and keeps an extra class name', () => {
    render(
      <MemoryRouter>
        <ButtonLink to="/projects/3/edit" variant="secondary" className="manage-only">
          수정
        </ButtonLink>
      </MemoryRouter>,
    )

    const link = screen.getByRole('link', { name: '수정' })
    expect(link).toHaveAttribute('data-variant', 'secondary')
    expect(link).toHaveClass('button', 'manage-only')
  })
})
