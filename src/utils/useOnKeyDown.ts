import { useEffect } from 'react'

export function useOnKeyDown(keyCode: number, handler: () => void) {
  useEffect(() => {
    function keyDown(e: KeyboardEvent) {
      if (e.keyCode === keyCode) {
        handler()
      }
    }

    document.addEventListener('keydown', keyDown)
    return () => {
      document.removeEventListener('keydown', keyDown)
    }
  }, [keyCode, handler])
}
