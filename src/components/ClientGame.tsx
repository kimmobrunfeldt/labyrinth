import React, { useEffect, useRef, useState } from 'react'
import { createClient } from 'src/core/client'
import { PieceOnBoard, type Board } from 'src/core/types'
import { EventEmitter } from 'src/core/utils'

export type Props = {
  serverPeerId: string
}
export const ClientGame = ({ serverPeerId }: Props) => {
  const [board, setBoard] = useState<Board | null>(null)
  const emitter = useRef(new EventEmitter())

  useEffect(() => {
    async function init() {
      const client = await createClient(serverPeerId)
      console.log(await client.getPublicState())
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
      client game
    </div>
  )
}
export default ClientGame
