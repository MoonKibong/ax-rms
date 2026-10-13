import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { ProjectStatus } from '../api/projects'
import Badge from './Badge'

// T#15 criterion 2: the project status badge always carries the status as text (BRIEF §3.6, D13).
const LABELS: Array<[ProjectStatus, string]> = [
  ['PLANNED', '계획'],
  ['IN_PROGRESS', '진행 중'],
  ['DONE', '완료'],
  ['ON_HOLD', '보류'],
]

describe('Badge', () => {
  it.each(LABELS)('writes %s as "%s" and records the status on the element', (status, label) => {
    render(<Badge status={status} />)

    const badge = screen.getByText(label)
    expect(badge).toHaveAttribute('data-status', status)
  })
})
