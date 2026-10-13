import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import Button from './Button'

describe('Button', () => {
  it('is busy while loading, keeps its label, and ignores clicks', () => {
    const onClick = vi.fn()
    render(
      <Button loading onClick={onClick}>
        저장
      </Button>,
    )

    const button = screen.getByRole('button')
    expect(button).toHaveAttribute('aria-busy', 'true')
    expect(button).toHaveTextContent('저장')
    fireEvent.click(button)
    expect(onClick).not.toHaveBeenCalled()
  })

  it('ignores clicks when disabled', () => {
    const onClick = vi.fn()
    render(
      <Button disabled onClick={onClick}>
        저장
      </Button>,
    )

    fireEvent.click(screen.getByRole('button'))
    expect(screen.getByRole('button')).toBeDisabled()
    expect(onClick).not.toHaveBeenCalled()
  })

  it('marks its variant and calls onClick when idle', () => {
    const onClick = vi.fn()
    render(
      <Button variant="danger" onClick={onClick}>
        해제
      </Button>,
    )

    const button = screen.getByRole('button', { name: '해제' })
    expect(button).toHaveAttribute('data-variant', 'danger')
    expect(button).not.toHaveAttribute('aria-busy')
    fireEvent.click(button)
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('defaults to the primary variant and type="button"', () => {
    render(<Button>확인</Button>)

    expect(screen.getByRole('button')).toHaveAttribute('data-variant', 'primary')
    expect(screen.getByRole('button')).toHaveAttribute('type', 'button')
  })
})
