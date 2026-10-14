import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import Dialog from './Dialog'

// T#39 criterion 3: the in-screen dialog (BRIEF §3.6) that the status change uses and #17 reuses for 배치 해제.
function Harness({ onClose = () => undefined, closable = true }: { onClose?: () => void; closable?: boolean }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        열기
      </button>
      <button type="button">바깥</button>
      {open ? (
        <Dialog
          title="상태 변경"
          closable={closable}
          onClose={() => {
            onClose()
            setOpen(false)
          }}
        >
          <label>
            상태
            <select defaultValue="a">
              <option value="a">가</option>
            </select>
          </label>
          <button type="button">취소</button>
          <button type="button">저장</button>
        </Dialog>
      ) : null}
    </>
  )
}

function openWithKeyboardFocus() {
  const opener = screen.getByRole('button', { name: '열기' })
  opener.focus()
  fireEvent.click(opener)
  expect(screen.getByRole('dialog', { name: '상태 변경' })).toBeInTheDocument()
  return opener
}

describe('Dialog', () => {
  it('is a modal dialog named by its title, and the first control has the focus', () => {
    render(<Harness />)
    openWithKeyboardFocus()

    const dialog = screen.getByRole('dialog', { name: '상태 변경' })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(screen.getByRole('heading', { level: 2, name: '상태 변경' })).toBeInTheDocument()
    expect(document.activeElement).toBe(screen.getByRole('combobox', { name: '상태' }))
  })

  it('calls onClose once on Escape and gives the focus back to the element that had it', () => {
    const onClose = vi.fn()
    render(<Harness onClose={onClose} />)
    const opener = openWithKeyboardFocus()

    fireEvent.keyDown(screen.getByRole('combobox', { name: '상태' }), { key: 'Escape' })

    expect(onClose).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(document.activeElement).toBe(opener)
  })

  it('does not close on Escape while closing is not allowed', () => {
    const onClose = vi.fn()
    render(<Harness onClose={onClose} closable={false} />)
    openWithKeyboardFocus()

    fireEvent.keyDown(screen.getByRole('combobox', { name: '상태' }), { key: 'Escape' })

    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('keeps Tab and Shift+Tab inside: from the last control to the first, and back', () => {
    render(<Harness />)
    openWithKeyboardFocus()
    const first = screen.getByRole('combobox', { name: '상태' })
    const last = screen.getByRole('button', { name: '저장' })

    last.focus()
    fireEvent.keyDown(last, { key: 'Tab' })
    expect(document.activeElement).toBe(first)

    fireEvent.keyDown(first, { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(last)
  })
})
