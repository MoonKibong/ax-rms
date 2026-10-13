import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import StateMessage from './StateMessage'

describe('StateMessage', () => {
  it('draws the three kinds with their BRIEF titles and roles', () => {
    render(
      <>
        <StateMessage kind="empty" />
        <StateMessage kind="no-results" />
        <StateMessage kind="error" />
      </>,
    )

    expect(screen.queryByText('표시할 항목이 없습니다')).toBeInTheDocument()
    expect(screen.getByText('아직 등록된 데이터가 없습니다.')).toBeInTheDocument()
    expect(screen.getByText('검색 결과가 없습니다')).toBeInTheDocument()
    expect(screen.getByText('검색어나 필터를 바꿔 다시 찾아보세요.')).toBeInTheDocument()
    expect(screen.getByText('데이터를 불러오지 못했습니다')).toBeInTheDocument()
    expect(screen.getByText('잠시 후 다시 시도하세요.')).toBeInTheDocument()
    expect(screen.getAllByRole('status')).toHaveLength(2)
    expect(screen.getByRole('alert')).toHaveTextContent('데이터를 불러오지 못했습니다')
    expect(new Set(screen.getAllByTestId('state-icon').map((icon) => icon.dataset.icon))).toEqual(
      new Set(['box', 'search', 'warning']),
    )
  })

  it('calls onRetry from the error and onReset from no results', () => {
    const onRetry = vi.fn()
    const onReset = vi.fn()
    render(
      <>
        <StateMessage kind="error" onRetry={onRetry} />
        <StateMessage kind="no-results" onReset={onReset} />
      </>,
    )

    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }))
    fireEvent.click(screen.getByRole('button', { name: '필터 초기화' }))
    expect(onRetry).toHaveBeenCalledTimes(1)
    expect(onReset).toHaveBeenCalledTimes(1)
  })

  it('lets a screen replace the title and description', () => {
    render(<StateMessage kind="empty" title="등록된 직원이 없습니다" description="직원을 등록하세요." />)

    expect(screen.getByText('등록된 직원이 없습니다')).toBeInTheDocument()
    expect(screen.getByText('직원을 등록하세요.')).toBeInTheDocument()
    expect(screen.queryByText('표시할 항목이 없습니다')).not.toBeInTheDocument()
  })
})
