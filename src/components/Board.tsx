import _ from 'lodash'
import React from 'react'
import Piece, {
  EmptyPiece,
  PIECE_MARGIN_PX,
  PIECE_WIDTH,
} from 'src/components/Piece'
import { type Board } from 'src/core/types'

export type Props = {
  board: Board
  // Additional styles for each piece
  boardPiecesStyles: React.CSSProperties[][]
}

const BoardComponent = ({ board, boardPiecesStyles }: Props) => {
  const piecesForRender = board.pieces.map((row, y) =>
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
      {_.flatten(piecesForRender).map(({ piece, style, x, y }) => {
        if (!piece) {
          return (
            <EmptyPiece key={`${y}-${x}`} style={style} position={{ x, y }} />
          )
        }

        return <Piece key={piece.id} style={style} {...piece} />
      })}
    </div>
  )
}

export default BoardComponent
