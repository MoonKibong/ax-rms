import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import Spinner from './Spinner'

// T#13 criterion 2: the loading ring (BRIEF §3.3) is decoration next to "불러오는 중…", hidden from assistive technology.
// Its 24px size and the stop under prefers-reduced-motion are measured in the browser (e2e/employees.spec.ts).
describe('Spinner', () => {
  it('draws one element hidden from assistive technology', () => {
    render(<Spinner />)

    const spinner = screen.getByTestId('spinner')
    expect(spinner).toHaveAttribute('aria-hidden', 'true')
    expect(spinner).toHaveClass('spinner')
  })
})
