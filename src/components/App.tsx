import _ from 'lodash'
import React, { useState } from 'react'
import BoardComponent from 'src/components/Board'
import { createGame } from 'src/core/game'
import { Game, PieceOnBoard, type Board } from 'src/core/types'
import './App.css'

export const App = () => {
  const onGameChange = (game: Game) => setBoard({ ...game.board })
  const game = createGame({ onStateChange: onGameChange })
  const [board, setBoard] = useState<Board>(game.gameState.board)
  const [boardPiecesStyles, setBoardPiecesStyles] = useState<
    React.CSSProperties[][]
  >(board.pieces.map((row) => row.map(() => ({ opacity: 1 }))))

  function markPieces(pieces: PieceOnBoard[]) {
    const newStyles = _.cloneDeep(boardPiecesStyles).map((row) =>
      row.map(() => ({ opacity: 0.2 }))
    )
    const marked = newStyles.map((row, y) =>
      row.map((p1, x) => {
        const shouldMark = pieces.some(
          (p2) => p2.position.x === x && p2.position.y === y
        )
        return shouldMark ? { opacity: 1 } : newStyles[y][x]
      })
    )
    setBoardPiecesStyles(marked)
  }

  return (
    <div
      className="App"
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <BoardComponent board={board} boardPiecesStyles={boardPiecesStyles} />
    </div>
  )
}
export default App
