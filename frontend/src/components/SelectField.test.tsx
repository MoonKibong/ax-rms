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
})
