import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import SegmentedControl from './SegmentedControl'

// T#15 criterion 3 (BRIEF §6.5 "한 줄 분할 버튼").
const OPTIONS = [
  { value: '', label: '전체' },
  { value: 'PLANNED', label: '계획' },
  { value: 'DONE', label: '완료' },
]

describe('SegmentedControl', () => {
  it('is a labelled group of buttons and only the selected one is pressed', () => {
    render(<SegmentedControl label="상태 필터" options={OPTIONS} value="PLANNED" onChange={() => undefined} />)

    const group = screen.getByRole('group', { name: '상태 필터' })
    expect(group).toBeInTheDocument()
    const buttons = screen.getAllByRole('button')
    expect(buttons.map((button) => button.textContent)).toEqual(['전체', '계획', '완료'])
    expect(buttons.map((button) => button.getAttribute('aria-pressed'))).toEqual(['false', 'true', 'false'])
  })

  it('calls onChange with the value of another button, and not for the selected one', () => {
    const onChange = vi.fn()
    render(<SegmentedControl label="상태 필터" options={OPTIONS} value="PLANNED" onChange={onChange} />)

    fireEvent.click(screen.getByRole('button', { name: '완료' }))
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith('DONE')

    fireEvent.click(screen.getByRole('button', { name: '계획' }))
    expect(onChange).toHaveBeenCalledTimes(1)
  })
})
