import React from 'react'
import { RotateIcon } from 'src/components/Icons'
import Piece, { PIECE_BORDER_RADIUS } from 'src/components/Piece'
import * as t from 'src/gameTypes'
import { getIsMyTurn, getPlayerInTurn } from 'src/utils/uiUtils'

export type Props = JSX.IntrinsicElements['div'] & {
  onClickExtraPiece: () => void
  position: t.Position
  pieceWidth: number
  piece: t.Piece
  gameState: t.ClientGameState
}

export const ExtraPiece = ({
  onClickExtraPiece,
  gameState,
  pieceWidth,
  piece,
  onMouseOut,
  onMouseOver,
}: Props) => {
  const { playerHasPushed } = gameState
  const playing = gameState.stage === 'playing'
  const isMyTurn = getIsMyTurn(gameState)
  const playerInTurn = getPlayerInTurn(gameState)

  return (
    <div
      onClick={() => playing && onClickExtraPiece()}
      onMouseOut={onMouseOut}
      onMouseOver={onMouseOver}
      className={`ExtraPiece ${
        isMyTurn && playing && !playerHasPushed ? 'cursor-pointer' : ''
      }`}
      style={{
        userSelect: 'none',
        position: 'absolute',
        width: `${pieceWidth}px`,
        height: `${pieceWidth}px`,
        margin: 0,
        padding: 0,
        background: '#eee',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: '-1px',
          left: '-1px',
          borderRadius: PIECE_BORDER_RADIUS,
          width: 'calc(100% + 2px)',
          height: 'calc(100% + 2px)',
          border: `2px solid ${
            playing && !playerHasPushed ? playerInTurn.color : '#aaa'
          }`,
        }}
      />
      <Piece
        style={{
          border: `1px solid transparent`,
          transition: 'all 300ms ease',
        }}
        width={pieceWidth}
        piece={piece}
      />
      <div
        className="ExtraPiece__fader"
        style={{
          borderRadius: '5px',
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          background: 'white',
        }}
      />
      <RotateIcon
        fill="#454545"
        style={{
          pointerEvents: 'none',
          position: 'absolute',
          zIndex: 10,
          top: '50%',
          left: '50%',
          width: '30%',
          transform: 'translate(-50%, -50%)',
        }}
      />
    </div>
  )
}
