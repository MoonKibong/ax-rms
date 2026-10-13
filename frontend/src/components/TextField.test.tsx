import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import TextField from './TextField'

describe('TextField', () => {
  it('connects the label to the input', () => {
    render(<TextField label="이름" />)

    const input = screen.getByLabelText('이름')
    expect(input.tagName).toBe('INPUT')
    expect(input).not.toHaveAttribute('aria-invalid')
  })

  it('shows the error right after the input and points to it', () => {
    render(<TextField label="투입률" error="투입률은 5%에서 100% 사이로 입력하세요." />)

    const input = screen.getByLabelText('투입률')
    const message = screen.getByText('투입률은 5%에서 100% 사이로 입력하세요.')
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(input.getAttribute('aria-describedby')).toBe(message.id)
    expect(message.id).not.toBe('')
    expect(input.compareDocumentPosition(message) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })
})
