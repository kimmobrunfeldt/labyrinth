import React from 'react'

export type Props = JSX.IntrinsicElements['button'] & {
  condensed?: boolean
}

export const Button = (props: Props) => (
  <button
    className={`button-50  ${props.condensed ? 'button-50-small' : ''}`}
    {...props}
  />
)
