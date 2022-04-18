import _ from 'lodash'
import React from 'react'
import Piece, {
  EmptyPiece,
  PIECE_MARGIN_PX,
  PIECE_WIDTH,
} from 'src/components/Piece'
import { PieceOnBoard, Player, type Board } from 'src/core/types'

export type Props = {
  board: Board
  players: Player[]
  // Additional styles for each piece
  boardPiecesStyles: React.CSSProperties[][]
  onClickPiece: (piece: PieceOnBoard) => void
}

const BoardComponent = ({ board, onClickPiece, boardPiecesStyles }: Props) => {
  const piecesForRender = _.flatten(
    board.pieces.map((row, y) =>
      row.map((piece, x) => {
        const style: React.CSSProperties = {
          ...boardPiecesStyles[y][x],
          position: 'absolute',
          top: `${PIECE_MARGIN_PX + y * (PIECE_WIDTH + PIECE_MARGIN_PX)}px`,
          left: `${PIECE_MARGIN_PX + x * (PIECE_WIDTH + PIECE_MARGIN_PX)}px`,
        }
        return {
          piece,
          style,
          x,
          y,
        }
      })
    )
  )

  return (
    <div
      style={{
        position: 'relative',
        background: '#FFFCF3',
        borderRadius: '10px',
        width: `${PIECE_WIDTH * 7 + PIECE_MARGIN_PX * 6}px`,
        height: `${PIECE_WIDTH * 7 + PIECE_MARGIN_PX * 6}px`,
        padding: `${PIECE_MARGIN_PX}px`,
        border: '5px solid #CDC5AB',
      }}
    >
      {piecesForRender.map(({ piece, style, x, y }) => {
        if (!piece) {
          return <EmptyPiece key={`${y}-${x}`} style={style} />
        }

        return (
          <div
            onClick={() => onClickPiece(piece)}
            key={piece.id}
            style={{
              ...style,
              width: `${PIECE_WIDTH}px`,
              height: `${PIECE_WIDTH}px`,
              position: 'absolute',
              margin: 0,
              padding: 0,
              transition: 'all 800ms ease',
            }}
          >
            <Piece
              style={{
                position: 'absolute',
              }}
              piece={piece}
            />
            {/* todo multiple players */}
            {piece.players.length > 0 &&
              piece.players.map((player, index) => (
                <div
                  key={player.id}
                  style={{
                    top: `${40 + index * 2}%`,
                    left: `${40 + index * 2}%`,
                    height: '16px',
                    width: '16px',
                    background: player.color,
                    position: 'absolute',
                  }}
                />
              ))}
          </div>
        )
      })}
    </div>
  )
}

export default BoardComponent
