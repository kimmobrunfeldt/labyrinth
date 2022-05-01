import React from 'react'
import Piece from 'src/components/Piece'
import { PlayerOnBoard } from 'src/components/PlayerOnBoard'
import * as t from 'src/gameTypes'

export type Props = JSX.IntrinsicElements['div'] & {
  piece: t.CensoredPieceOnBoard
  style?: React.CSSProperties
  pieceWidth: number
  gameState: t.ClientGameState
  playerLabelsVisible: boolean
}

export const PieceOnBoard = ({
  onClick,
  onMouseOver,
  onMouseOut,
  piece,
  style = {},
  pieceWidth,
  gameState,
  playerLabelsVisible,
}: Props) => {
  return (
    <div
      onClick={onClick}
      onMouseOver={onMouseOver}
      onMouseOut={onMouseOut}
      style={{
        ...style,
        width: `${pieceWidth}px`,
        height: `${pieceWidth}px`,
        position: 'absolute',
        margin: 0,
        padding: 0,
      }}
    >
      <Piece
        width={pieceWidth}
        style={{
          position: 'absolute',
        }}
        piece={piece}
      />
      {piece.players.length > 0 &&
        piece.players.map((player, index) => {
          return (
            <div
              key={player.id}
              style={{
                zIndex: 900,
                top: '50%',
                left: '50%',
                transform: `translate(calc(-50% + ${
                  index * 3
                }px), calc(-50% + ${index * 3}px))`,
                height: '30%',
                width: '30%',
                position: 'absolute',
              }}
            >
              <PlayerOnBoard
                showName={index === 0 && playerLabelsVisible}
                gameState={gameState}
                player={player}
                piece={piece}
              />
            </div>
          )
        })}
    </div>
  )
}
