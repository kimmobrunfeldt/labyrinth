import _ from 'lodash'
import React, { useEffect, useState } from 'react'
import Piece, { EmptyPiece, STYLES } from 'src/components/Piece'
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
    <div>
      {board.map((row, rowIndex) => {
        return (
          <div style={{ height: STYLES.height }} key={rowIndex}>
            {row.map((piece, pieceIndex) => {
              if (!piece) {
                return <EmptyPiece />
              }

              return <Piece key={pieceIndex} {...piece} />
            })}
          </div>
        )
      })}
    </div>
  )
}
export default Board
