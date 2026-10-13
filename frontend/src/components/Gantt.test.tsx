import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import Gantt from './Gantt'
import type { GanttAssignment } from './gantt/model'

function assignment(over: Partial<GanttAssignment> & Pick<GanttAssignment, 'id' | 'start' | 'end' | 'rate'>): GanttAssignment {
  return { projectName: `프로젝트 ${over.id}`, projectStatus: '진행 중', ...over }
}

const A = assignment({ id: 'A', start: '2026-10-01', end: '2026-10-20', rate: 60 })
const B = assignment({ id: 'B', start: '2026-10-15', end: '2026-10-31', rate: 30, projectStatus: '완료' })

describe('Gantt', () => {
  it('draws one bar per assignment with an accessible name and no text inside', () => {
    render(<Gantt assignments={[A, B]} today="2026-10-10" />)
    const barA = screen.getByRole('img', { name: '프로젝트 A, 2026-10-01 ~ 2026-10-20, 60%' })
    const barB = screen.getByRole('img', { name: '프로젝트 B, 2026-10-15 ~ 2026-10-31, 30%' })
    expect(barA).toHaveAttribute('data-status', 'active')
    expect(barB).toHaveAttribute('data-status', 'other')
    expect(barA.textContent).toBe('')
    expect(barB.textContent).toBe('')
    expect(screen.getAllByTestId('gantt-bar')).toHaveLength(2)
  })

  it('writes period and rate below the bar, hidden from assistive technology', () => {
    render(<Gantt assignments={[A]} today="2026-10-10" />)
    const label = screen.getByText('2026-10-01 ~ 2026-10-20 · 60%')
    expect(label).toHaveAttribute('aria-hidden', 'true')
    expect(label).toHaveAttribute('data-gantt-text')
  })

  it('has one overlap row with the day total when 60% and 30% partly overlap', () => {
    render(<Gantt assignments={[A, B]} today="2026-10-10" />)
    const bands = screen.getAllByTestId('gantt-overlap')
    expect(bands).toHaveLength(1)
    expect(bands[0]).toHaveAccessibleName('2026-10-15 ~ 2026-10-20, 합계 90%')
    expect(screen.getAllByText('90%')).toHaveLength(1)
  })

  it('has no overlap row and no total when the assignments do not overlap', () => {
    const later = assignment({ id: 'C', start: '2026-11-01', end: '2026-11-10', rate: 30 })
    render(<Gantt assignments={[A, later]} today="2026-10-10" />)
    expect(screen.getAllByTestId('gantt-bar')).toHaveLength(2)
    expect(screen.queryAllByTestId('gantt-overlap')).toHaveLength(0)
    expect(screen.queryByText(/합계/)).toBeNull()
  })

  it('has one overlap row per distinct total', () => {
    const list = [
      assignment({ id: 'A', start: '2026-10-01', end: '2026-10-30', rate: 50 }),
      assignment({ id: 'B', start: '2026-10-10', end: '2026-10-20', rate: 30 }),
      assignment({ id: 'C', start: '2026-10-15', end: '2026-10-25', rate: 20 }),
    ]
    render(<Gantt assignments={list} today="2026-10-12" />)
    expect(screen.getAllByTestId('gantt-overlap')).toHaveLength(3)
  })

  it('shows the "오늘" label and line only when today is inside the span', () => {
    const { unmount } = render(<Gantt assignments={[A]} today="2026-10-10" />)
    expect(screen.getByText('오늘')).toBeInTheDocument()
    expect(screen.getAllByTestId('gantt-today-line').length).toBeGreaterThan(0)
    unmount()

    render(<Gantt assignments={[A]} today="2026-12-01" />)
    expect(screen.queryByText('오늘')).toBeNull()
    expect(screen.queryAllByTestId('gantt-today-line')).toHaveLength(0)
  })

  it('writes the month in the top axis', () => {
    render(<Gantt assignments={[A]} today="2026-10-10" />)
    expect(screen.getByText('10월')).toBeInTheDocument()
  })

  it('shows the empty state instead of a chart when there is nothing to draw', () => {
    render(<Gantt assignments={[]} today="2026-10-10" />)
    const status = screen.getByRole('status')
    expect(within(status).getByText('배치된 프로젝트가 없습니다')).toBeInTheDocument()
    expect(screen.queryAllByTestId('gantt-bar')).toHaveLength(0)
  })

  it('requires `today`', () => {
    // Never called: the point is that the call below does not type-check without `today`.
    const withoutToday = () => (
      // @ts-expect-error today is required: leaving it out must not compile (tsc -b fails on an unused directive otherwise)
      <Gantt assignments={[A]} />
    )
    expect(typeof withoutToday).toBe('function')
  })
})
