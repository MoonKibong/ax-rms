import { useId, type ButtonHTMLAttributes, type MouseEvent } from 'react'
import './Button.css'

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'danger'
  loading?: boolean
}

// BRIEF §3.1. While loading the label stays in the DOM (hidden), so the width does not change; the button keeps
// its accessible name through aria-labelledby and ignores clicks.
function Button({ variant = 'primary', loading = false, type = 'button', className, onClick, children, ...rest }: ButtonProps) {
  const labelId = useId()
  const ignore = (event: MouseEvent<HTMLButtonElement>) => event.preventDefault()

  return (
    <button
      {...rest}
      type={type}
      className={className ? `button ${className}` : 'button'}
      data-variant={variant}
      aria-busy={loading ? true : undefined}
      aria-labelledby={loading ? labelId : undefined}
      onClick={loading ? ignore : onClick}
    >
      <span id={labelId} className="button__label">
        {children}
      </span>
      {loading ? <span className="button__spinner" aria-hidden="true" /> : null}
    </button>
  )
}

export default Button
