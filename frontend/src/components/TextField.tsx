import { useId, type InputHTMLAttributes } from 'react'
import { WarningIcon } from './icons'
import './TextField.css'

type TextFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> & {
  label: string
  error?: string
  hint?: string
}

// BRIEF §3.2. The error replaces the hint, sits right under the input (D33), and the input points to it.
function TextField({ label, error, hint, required, className, ...inputProps }: TextFieldProps) {
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
        aria-invalid={error ? true : undefined}
        aria-describedby={message ? messageId : undefined}
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
