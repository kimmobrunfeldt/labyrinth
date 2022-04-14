import _ from 'lodash'
import React, { useEffect, useState } from 'react'
import Piece, {
  EmptyPiece,
  PIECE_MARGIN_PX,
  STYLES,
} from 'src/components/Piece'
import { fill, fillBoard, getPieceAt, isFilled } from 'src/core/board'
import { createBoard, createPieces } from 'src/core/pieces'
import { Board as BoardType, Position, PositionPiece } from 'src/core/types'

export const Board = () => {
  const [board, setBoard] = useState<BoardType>(createBoard())
  const [boardUi, setBoardUi] = useState<{ opacity: number }[][]>(
    board.map((row) => row.map((p) => ({ opacity: 1 })))
  )

  function onClickPiece(position: Position) {
    if (!isFilled(board)) {
      return
    }
    const newBoardUi = _.cloneDeep(boardUi).map((row) =>
      row.map(() => ({ opacity: 0.5 }))
    )

    const pieces = fill(
      board,
      new Set<PositionPiece>(),
      new Set<PositionPiece>([getPieceAt(board, position)])
    )
    pieces.forEach((p) => {
      newBoardUi[p.position.y][p.position.x] = { opacity: 1 }
    })

    // newBoardUi[position.y][position.x] = { opacity: 1 }
    setBoardUi(newBoardUi)
  }

  useEffect(() => {
    async function initial() {
      for (const _val of _.times(1)) {
        // await new Promise((resolve) => setTimeout(resolve, 2000))

        const pieces = createPieces()
        const board = fillBoard(createBoard(), { pieces })
        setBoard(board)
        return

        /*
        while (pieces.length > 1) {
          board = fillBoard(board, { pieces, maxFillPieces: 1 })
          setBoard(board)
          await new Promise((resolve) => setTimeout(resolve, 30))
        }

        await new Promise((resolve) => setTimeout(resolve, 2000))
        */
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
      {board.map((row, y) => {
        return (
          <div
            style={{
              height: STYLES.height,
              marginBottom: `${PIECE_MARGIN_PX}px`,
            }}
            key={y}
          >
            {row.map((piece, x) => {
              const isLast = x === row.length - 1
              const style = boardUi[y][x]
              if (!piece) {
                return (
                  <EmptyPiece
                    key={x}
                    style={style}
                    isLastInRow={isLast}
                    position={{ x, y }}
                  />
                )
              }

              return (
                <Piece
                  key={x}
                  style={style}
                  onClick={onClickPiece}
                  isLastInRow={isLast}
                  {...piece}
                />
              )
            })}
          </div>
        )
      })}
    </div>
  )
}
export default Board
