import React from 'react'
import 'src/css/Select.css'

type Props = {
  value: string
  placeholder: string
  onChange: (value: string) => void
  options: Array<{ value: string; label: string }>
}

export const Select = ({ value, onChange, options, placeholder }: Props) => (
  <select
    value={value}
    onChange={(e) => onChange(e.target.value)}
    className="Select"
  >
    <option value="" disabled>
      {placeholder}
    </option>
    {options.map((o) => {
      return (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      )
    })}
  </select>
)
