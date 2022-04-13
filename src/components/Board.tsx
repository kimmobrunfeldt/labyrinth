import _ from 'lodash'
import React, { useEffect, useState } from 'react'
import Piece, {
  EmptyPiece,
  PIECE_MARGIN_PX,
  STYLES,
} from 'src/components/Piece'
import { fillBoard } from 'src/core/board'
import { createBoard, createPieces } from 'src/core/pieces'
import { Board as BoardType } from 'src/core/types'

export const Board = () => {
  const [board, setBoard] = useState<BoardType>(createBoard())

  useEffect(() => {
    async function initial() {
      for (const _val of _.times(1)) {
        await new Promise((resolve) => setTimeout(resolve, 2000))

        const pieces = createPieces()
        let board = createBoard()
        while (pieces.length > 1) {
          board = fillBoard(board, { pieces, maxFillPieces: 1 })
          setBoard(board)
          await new Promise((resolve) => setTimeout(resolve, 30))
        }

        await new Promise((resolve) => setTimeout(resolve, 2000))
      }
    }
    initial()
  }, [])

  return (
    <div
      style={{
        background: '#FFFCF3',
        borderRadius: '10px',
        width: `${80 * 7 + PIECE_MARGIN_PX * 6}px`,
        height: `${80 * 7 + PIECE_MARGIN_PX * 6}px`,
        padding: '5px',
        border: '5px solid #CDC5AB',
      }}
    >
      {board.map((row, rowIndex) => {
        return (
          <div
            style={{
              height: STYLES.height,
              marginBottom: `${PIECE_MARGIN_PX}px`,
            }}
            key={rowIndex}
          >
            {row.map((piece, pieceIndex) => {
              const isLast = pieceIndex === row.length - 1
              if (!piece) {
                return <EmptyPiece isLastInRow={isLast} />
              }

              return <Piece isLastInRow={isLast} key={pieceIndex} {...piece} />
            })}
          </div>
        )
      })}
    </div>
  )
}
export default Board
