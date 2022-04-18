import _ from 'lodash'
import {
  assertDefined,
  findConnected,
  getPieceAt,
  pushPositions,
} from 'src/core/board'
import * as t from 'src/core/types'

export function createBot(server: t.Server): t.ControlledPlayer {
  let gameState: t.GamePlaying | t.GameFinished

  return {
    onStateChange: async (game: t.Game) => {
      gameState = game as t.GamePlaying | t.GameFinished
    },
    getPush: async () => {
      await new Promise((resolve) => setTimeout(resolve, 1000))

      return {
        position: assertDefined(_.sample(pushPositions)),
        rotation: 0,
      }
    },
    getMove: async () => {
      await new Promise((resolve) => setTimeout(resolve, 600))
      const currentPos = server.getMyPosition()
      const piece = getPieceAt(gameState.board, currentPos)
      const connected = _.shuffle(
        findConnected(gameState.board, new Set([assertDefined(piece)]))
      )
      // Prefer another piece
      const newPos =
        connected.find(
          (p) => p.position.x !== currentPos.x && p.position.y !== currentPos.y
        )?.position ?? currentPos
      return newPos
    },
  }
}
