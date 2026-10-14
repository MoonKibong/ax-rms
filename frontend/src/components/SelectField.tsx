import { useId, type SelectHTMLAttributes } from 'react'
import './TextField.css'
import './SelectField.css'

export type SelectOption = { value: string; label: string }

type SelectFieldProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, 'id' | 'value' | 'onChange'> & {
  label: string
  options: SelectOption[]
  value: string
  onChange: (value: string) => void
}

// BRIEF §3.2: a select box has the TextField's label, height, border and text (the label and column come from
// TextField.css). An error message comes with the first form that needs one.
function SelectField({ label, options, value, onChange, className, ...selectProps }: SelectFieldProps) {
  const id = useId()

  return (
    <div className={className ? `field ${className}` : 'field'}>
      <label className="field__label" htmlFor={id}>
        {label}
      </label>
      <select
        {...selectProps}
        id={id}
        className="select-field__select"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  )
}

export default SelectField
