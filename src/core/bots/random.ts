import _ from 'lodash'
import {
  assertDefined,
  BOARD_PUSH_POSITIONS,
  findConnected,
  getPieceAt,
} from 'src/core/board'
import { Client, createClient } from 'src/core/client'
import { GameServer } from 'src/core/server'
import * as t from 'src/gameTypes'
import { loopUntilSuccess } from 'src/utils/utils'

export async function connectBot(
  playerId: string,
  server: Pick<GameServer, 'peerId'>
) {
  let gameState: t.ClientGameState

  const turnsReacted = new Set<number>()
  const client = await createClient({
    playerId,
    serverPeerId: server.peerId,
    onStateChange: async (state) => {
      gameState = state

      if (gameState.stage !== 'playing') {
        return
      }

      const playerInTurn = state.players[state.playerTurn]
      if (
        turnsReacted.has(gameState.turnCounter) ||
        playerInTurn.id !== state.me.id
      ) {
        return
      }

      turnsReacted.add(gameState.turnCounter)

      // Loop until success, because the bot doesn't know all rules
      await new Promise((resolve) => setTimeout(resolve, 1000))
      await loopUntilSuccess(
        async () => {
          await push(gameState, client)
        },
        { maxTries: 5, onError: (err) => console.error('Unable to push', err) }
      )

      await new Promise((resolve) => setTimeout(resolve, 800))
      await loopUntilSuccess(
        async () => {
          await move(gameState, client)
        },
        { maxTries: 5, onError: (err) => console.error('Unable to move', err) }
      )
    },
  })

  return client
}

async function push(_gameState: t.ClientGameState, client: Client) {
  // Push
  const pushPos = assertDefined(_.sample(BOARD_PUSH_POSITIONS))
  await client.client.push(pushPos)
}

async function move(gameState: t.ClientGameState, client: Client) {
  if (!gameState.myPosition) {
    throw new Error('My position not found from state')
  }

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
  await client.client.move(newPos)
}
