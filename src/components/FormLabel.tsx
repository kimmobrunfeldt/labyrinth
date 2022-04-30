import React from 'react'
export type Props = JSX.IntrinsicElements['label']

export const FormLabel = (props: Props) => (
  <label
    style={{
      display: 'block',
      marginBottom: '6px',
      fontSize: '14px',
      color: '#666',
    }}
    {...props}
  />
)
