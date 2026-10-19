import { useId, type SelectHTMLAttributes } from 'react'
import { WarningIcon } from './icons'
import './TextField.css'
import './SelectField.css'

export type SelectOption = { value: string; label: string }

type SelectFieldProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, 'id' | 'value' | 'onChange'> & {
  label: string
  options: SelectOption[]
  value: string
  onChange: (value: string) => void
  error?: string
}

// BRIEF §3.2: a select box has the TextField's label, height, border and text (the label and column come from
// TextField.css), and the TextField's required and error rules (T#39): the error sits right under the select (D33)
// and the select points to it. A caller's aria-describedby is kept in front of the message id, and a caller's
// aria-invalid counts as an error (T#58).
function SelectField({
  label,
  options,
  value,
  onChange,
  className,
  error,
  required,
  'aria-describedby': describedBy,
  'aria-invalid': invalid,
  ...selectProps
}: SelectFieldProps) {
  const id = useId()
  const messageId = `${id}-message`

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
      <select
        {...selectProps}
        id={id}
        className="select-field__select"
        value={value}
        required={required}
        aria-invalid={error || (invalid && invalid !== 'false') ? true : undefined}
        aria-describedby={[describedBy, error ? messageId : undefined].filter(Boolean).join(' ') || undefined}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error ? (
        <p id={messageId} className="field__error">
          <WarningIcon size={16} />
          {error}
        </p>
      ) : null}
    </div>
  )
}

export default SelectField
