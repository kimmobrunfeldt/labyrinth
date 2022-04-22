import { useEffect } from 'react'

export type Props = {
  when?: boolean
  message?: string
}

export default function ConfirmLeave({
  when = false,
  message = 'Game will be cancelled when the host leaves. Continue leaving?',
}: Props) {
  useEffect(() => {
    if (when) {
      window.onbeforeunload = () => message
    } else {
      window.onbeforeunload = null
    }

    return () => {
      window.onbeforeunload = null
    }
  }, [when, message])

  return null
}
