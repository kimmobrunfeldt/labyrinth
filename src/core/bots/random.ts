import _ from 'lodash'
import {
  assertDefined,
  findConnected,
  getPieceAt,
  pushPositions,
} from 'src/core/board'
import { createClient } from 'src/core/client'
import { GameServer } from 'src/core/server'
import * as t from 'src/core/types'

export async function createBot(
  playerId: string,
  server: Pick<GameServer, 'peerId'>
) {
  let gameState: t.ClientGameState

  const client = await createClient(playerId, server.peerId, {
    onStateChange: async (state) => {
      gameState = state
    },
    getMove: async () => {
      if (!gameState.myPosition) {
        throw new Error('Unexpected getMove')
      }

      await new Promise((resolve) => setTimeout(resolve, 600))
      const currentPos = gameState.myPosition
      const piece = getPieceAt(
        gameState.board as unknown as t.FilledBoard,
        currentPos
      )
      const connected = _.shuffle(
        findConnected(
          gameState.board as unknown as t.Board,
          new Set([assertDefined(piece)])
        )
      )
      // Prefer another piece
      const newPos =
        connected.find(
          (p) => p.position.x !== currentPos.x && p.position.y !== currentPos.y
        )?.position ?? currentPos
      return newPos
    },
    getPush: async () => {
      await new Promise((resolve) => setTimeout(resolve, 1000))

      return assertDefined(_.sample(pushPositions))
    },
  })

  gameState = await client.getState()
  await client.setMyName('Random bot')
  return client
}
