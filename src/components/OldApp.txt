import _ from 'lodash'
import React, { useEffect, useRef, useState } from 'react'
import BoardComponent from 'src/components/Board'
import PieceComponent from 'src/components/Piece'
import { getPushPosition } from 'src/core/board'
import { createBot } from 'src/core/bots/random'
import { createLocalPlayer } from 'src/core/createLocalPlayer'
import { createGameLoop } from 'src/core/gameLoop'
import {
  Game,
  PieceOnBoard,
  PlayerColor,
  Position,
  type Board,
} from 'src/core/types'
import { EventEmitter } from 'src/core/utils'
import './App.css'

export const App = () => {
  const [gameLoop, setGameLoop] = useState<Awaited<
    ReturnType<typeof createGameLoop>
  > | null>(null)
  const [board, setBoard] = useState<Board | null>(null)
  const [boardPiecesStyles, setBoardPiecesStyles] = useState<
    React.CSSProperties[][] | null
  >(null)

  const emitter = useRef(new EventEmitter())

  useEffect(() => {
    async function init() {
      const onGameChange = (game: Game) => setBoard({ ...game.board })
      const gameLoop = await createGameLoop({
        onStateChange: onGameChange,
        cardsPerPlayer: 1,
      })
      setGameLoop(gameLoop)
      await gameLoop.addPlayer(
        {
          name: 'Host',
          color: PlayerColor.Blue,
        },
        createLocalPlayer({
          askForMove: async () => {
            const pos = await new Promise((resolve) => {
              emitter.current.addEventListener(
                'onClickPiece',
                _.once((e) => {
                  resolve(e.piece.position)
                })
              )
            })

            return pos as Position
          },

          askForPush: async () => {
            const pos = await new Promise((resolve) => {
              emitter.current.addEventListener(
                'onClickPiece',
                _.once((e) => {
                  resolve(e.piece.position)
                })
              )
            })

            return {
              position: getPushPosition(pos as Position),
              rotation: 0,
            }
          },
        })
      )

      await gameLoop.addPlayer(
        {
          name: 'Bot',
          color: PlayerColor.Red,
        },
        createBot
      )

      const gameState = gameLoop.getState()
      setBoard(gameState.board)
      setBoardPiecesStyles(
        gameState.board.pieces.map((row) => row.map(() => ({ opacity: 1 })))
      )

      gameLoop.start()
      while (gameLoop.getState().stage !== 'finished') {
        console.log('game loop')
        await gameLoop.turn()
      }
      console.log('game finished!')
      console.log(
        'winners',
        gameLoop.getState().winners.map((w) => w.name)
      )
    }

    init()
  }, [])

  function onClickPiece(piece: PieceOnBoard) {
    // todo: update react ui
    emitter.current.dispatch('onClickPiece', { piece })
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
      {gameLoop && board && boardPiecesStyles && (
        <BoardComponent
          players={gameLoop.getState().players}
          board={board}
          boardPiecesStyles={boardPiecesStyles}
          onClickPiece={onClickPiece}
        />
      )}
      {gameLoop && (
        <PieceComponent style={{}} piece={gameLoop.getState().pieceBag[0]} />
      )}
    </div>
  )
}
export default App
