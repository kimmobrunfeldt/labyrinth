import React from 'react'
import 'src/css/Button.css'

export type Props = JSX.IntrinsicElements['button'] & {
  condensed?: boolean
}

export const Button = ({ condensed, ...props }: Props) => (
  <button
    className={`Button  ${condensed ? 'Button--small' : ''}`}
    {...props}
  />
)
