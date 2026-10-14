import './SegmentedControl.css'

export type SegmentedOption = { value: string; label: string }

type SegmentedControlProps = {
  label: string
  options: SegmentedOption[]
  value: string
  onChange: (value: string) => void
}

// BRIEF §6.5 "한 줄 분할 버튼": one row of equal buttons, one of them pressed. Choosing the pressed one does nothing.
function SegmentedControl({ label, options, value, onChange }: SegmentedControlProps) {
  return (
    <div className="segmented" role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className="segmented__item"
          aria-pressed={option.value === value}
          onClick={() => {
            if (option.value !== value) {
              onChange(option.value)
            }
          }}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

export default SegmentedControl
