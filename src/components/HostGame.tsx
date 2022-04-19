import React, { useEffect, useRef, useState } from 'react'
import { createServer } from 'src/core/server'
import { PieceOnBoard, type Board } from 'src/core/types'
import { EventEmitter } from 'src/core/utils'
import './App.css'

export type Props = any

export const HostGame = () => {
  const [board, setBoard] = useState<Board | null>(null)
  const emitter = useRef(new EventEmitter())

  useEffect(() => {
    async function init() {
      const server = await createServer()
      console.log(server)
    }
    init()
  }, [])

  function onClickPiece(piece: PieceOnBoard) {
    // todo: update react ui
    emitter.current.dispatch('onClickPiece', { piece })
  }

  return (
    <div
      className="ClientGame"
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      {' '}
      host game{' '}
    </div>
  )
}

export default HostGame
