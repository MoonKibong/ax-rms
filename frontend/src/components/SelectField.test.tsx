import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import SelectField from './SelectField'

// T#13 criterion 2: the select box (BRIEF §3.2) — a label tied to the select, the options in order, and onChange(value).
const OPTIONS = [
  { value: '', label: '전체' },
  { value: '1', label: '개발팀' },
  { value: '3', label: '디자인팀' },
]

describe('SelectField', () => {
  it('ties the label to the select and draws the given options in order', () => {
    render(<SelectField label="부서" options={OPTIONS} value="1" onChange={() => undefined} />)

    const select = screen.getByLabelText('부서')
    expect(select.tagName).toBe('SELECT')
    expect(within(select).getAllByRole('option').map((option) => option.textContent)).toEqual([
      '전체',
      '개발팀',
      '디자인팀',
    ])
    expect(select).toHaveValue('1')
  })

  it('calls onChange with the chosen value', () => {
    const onChange = vi.fn()
    render(<SelectField label="부서" options={OPTIONS} value="" onChange={onChange} />)

    fireEvent.change(screen.getByLabelText('부서'), { target: { value: '3' } })

    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith('3')
  })

  // T#39 criterion 2: the TextField error and required rules for a select box (BRIEF §3.2).
  it('shows an error right under the select with the warning icon, and the select points to it', () => {
    render(
      <SelectField label="부서" options={OPTIONS} value="" onChange={() => undefined} error="부서를 찾을 수 없습니다." />,
    )

    const message = screen.getByText('부서를 찾을 수 없습니다.')
    const select = screen.getByRole('combobox', { name: '부서' })
    expect(select).toHaveAttribute('aria-invalid', 'true')
    expect(select.getAttribute('aria-describedby')).toBe(message.id)
    expect(message.id).not.toBe('')
    expect(select).toHaveAccessibleDescription('부서를 찾을 수 없습니다.')
    expect(message.querySelector('svg')).not.toBeNull()
    expect(select.nextElementSibling).toBe(message)
  })

  it('marks a required select with an aria-hidden star after the label and the required attribute', () => {
    render(<SelectField label="부서" options={OPTIONS} value="" onChange={() => undefined} required />)

    const select = screen.getByRole('combobox', { name: '부서' })
    expect(select).toBeRequired()
    const star = screen.getByText('*')
    expect(star).toHaveAttribute('aria-hidden', 'true')
    expect(star.closest('label')).toHaveAttribute('for', select.id)
  })

  it('has no error or required marks when neither is given', () => {
    render(<SelectField label="부서" options={OPTIONS} value="" onChange={() => undefined} />)

    const select = screen.getByRole('combobox', { name: '부서' })
    expect(select).not.toHaveAttribute('aria-invalid')
    expect(select).not.toHaveAttribute('aria-describedby')
    expect(select).not.toBeRequired()
    expect(screen.queryByText('*')).not.toBeInTheDocument()
  })

  // T#58 criterion 1: the caller's aria-* are merged with the field's own, not overwritten.
  it('merges the caller aria-describedby with its own message id and keeps the caller aria-invalid', () => {
    const { rerender } = render(
      <SelectField label="부서" options={OPTIONS} value="" onChange={() => undefined} aria-describedby="x" error="고르세요" />,
    )

    const message = screen.getByText('고르세요')
    expect(screen.getByRole('combobox', { name: '부서' }).getAttribute('aria-describedby')).toBe(`x ${message.id}`)

    rerender(<SelectField label="부서" options={OPTIONS} value="" onChange={() => undefined} aria-describedby="x" />)
    expect(screen.getByRole('combobox', { name: '부서' }).getAttribute('aria-describedby')).toBe('x')
    expect(screen.getByRole('combobox', { name: '부서' })).not.toHaveAttribute('aria-invalid')

    rerender(<SelectField label="부서" options={OPTIONS} value="" onChange={() => undefined} aria-invalid />)
    expect(screen.getByRole('combobox', { name: '부서' })).toHaveAttribute('aria-invalid', 'true')
  })
})
