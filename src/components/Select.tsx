import React from 'react'
import 'src/css/Select.css'

type Props = JSX.IntrinsicElements['select'] & {
  placeholder?: string
  disabled?: boolean
  onChange: (value: string) => void
  options: Array<{ value: string; label: string }>
}

export const Select = ({
  value,
  disabled,
  onChange,
  options,
  placeholder,
  ...props
}: Props) => (
  <select
    {...props}
    disabled={disabled}
    value={value}
    onChange={(e) => !disabled && onChange(e.target.value)}
    className="Select"
  >
    {placeholder && (
      <option value="" disabled>
        {placeholder}
      </option>
    )}
    {options.map((o) => {
      return (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      )
    })}
  </select>
)
