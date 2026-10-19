import { useId, type InputHTMLAttributes } from 'react'
import { WarningIcon } from './icons'
import './TextField.css'

type TextFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> & {
  label: string
  error?: string
  hint?: string
}

// BRIEF §3.2. The error replaces the hint, sits right under the input (D33), and the input points to it. A caller's
// aria-describedby is kept in front of the message id, and a caller's aria-invalid counts as an error (T#58).
function TextField({
  label,
  error,
  hint,
  required,
  className,
  'aria-describedby': describedBy,
  'aria-invalid': invalid,
  ...inputProps
}: TextFieldProps) {
  const id = useId()
  const messageId = `${id}-message`
  const message = error ?? hint

  return (
    <div className={className ? `field ${className}` : 'field'}>
      <label className="field__label" htmlFor={id}>
        {label}
        {required ? (
          <span className="field__required" aria-hidden="true">
            *
          </span>
        ) : null}
      </label>
      <input
        {...inputProps}
        id={id}
        className="field__input"
        required={required}
        aria-invalid={error || (invalid && invalid !== 'false') ? true : undefined}
        aria-describedby={[describedBy, message ? messageId : undefined].filter(Boolean).join(' ') || undefined}
      />
      {error ? (
        <p id={messageId} className="field__error">
          <WarningIcon size={16} />
          {error}
        </p>
      ) : hint ? (
        <p id={messageId} className="field__hint">
          {hint}
        </p>
      ) : null}
    </div>
  )
}

export default TextField
