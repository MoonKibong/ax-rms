import { useEffect, useId, useRef, type KeyboardEvent, type MouseEvent, type ReactNode } from 'react'
import './Dialog.css'

type DialogProps = {
  title: string
  onClose: () => void
  // False while the dialog's action is under way: Escape does not close it then.
  closable?: boolean
  children: ReactNode
}

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

function focusables(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE))
}

// T#39, BRIEF §3.6 "화면 안 대화상자": a modal dialog drawn over the screen while it is rendered. It takes the focus
// to its first control, keeps Tab and Shift+Tab inside, closes on Escape, and gives the focus back to the element
// that had it before. #17 reuses it for the 배치 해제 confirmation.
function Dialog({ title, onClose, closable = true, children }: DialogProps) {
  const titleId = useId()
  const panel = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const before = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const root = panel.current
    if (root) {
      const first = focusables(root)[0] ?? root
      first.focus()
    }
    return () => {
      before?.focus()
    }
  }, [])

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      if (closable) {
        onClose()
      }
      return
    }
    if (event.key !== 'Tab' || !panel.current) {
      return
    }
    const items = focusables(panel.current)
    if (items.length === 0) {
      event.preventDefault()
      return
    }
    const first = items[0]
    const last = items[items.length - 1]
    const current = document.activeElement
    const inside = current instanceof HTMLElement && items.includes(current)
    if (event.shiftKey && (current === first || !inside)) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && (current === last || !inside)) {
      event.preventDefault()
      first.focus()
    }
  }

  // Pressing the backdrop keeps the focus where it is (inside the dialog) and does not close it.
  function handleBackdropMouseDown(event: MouseEvent<HTMLDivElement>) {
    if (event.target === event.currentTarget) {
      event.preventDefault()
    }
  }

  return (
    <div className="dialog-backdrop" onMouseDown={handleBackdropMouseDown}>
      <div
        ref={panel}
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
      >
        <h2 id={titleId} className="dialog__title">
          {title}
        </h2>
        {children}
      </div>
    </div>
  )
}

export default Dialog
