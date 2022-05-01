import _ from 'lodash'
import { BotCreateOptions, BotImplementation } from 'src/core/bots/framework'
import { Client } from 'src/core/client'
import {
  assertDefined,
  BOARD_PUSH_POSITIONS,
  findConnected,
  getPieceAt,
} from 'src/core/server/board'
import * as t from 'src/gameTypes'
import { loopUntilSuccess } from 'src/utils/utils'

export const name = 'Random bot'

/**
 * Warning! You must use `client` as is, because it's a Proxy object for
 * reconnect purposes. Don't take any properties out of it, it will break.
 *
 * Do not:
 *
 *   // Bad
 *   const { serverRpc } = client
 *
 *   // Bad
 *   const getMyPosition = client.serverRpc.getMyPosition()
 *
 * Whatever you need to access within client, always use the full property path:
 *
 *   client.serverRpc.getMyPosition()
 *
 * @returns Promise so that the bot creation can do something async if needed.
 */
export async function create({
  logger,
  client,
}: BotCreateOptions): Promise<BotImplementation> {
  return {
    async onMyTurn(getState) {
      await new Promise((resolve) => setTimeout(resolve, 2000)) // "thinking time"

      const state = getState()
      // Loop until success, because the bot doesn't understand the blocked push
      // position rule
      await loopUntilSuccess(
        async () => {
          await push(state, client)
        },
        { maxTries: 5, onError: (err) => logger.error('Unable to push', err) }
      )

      const stateAfterPush = getState()
      // Do a move
      await new Promise((resolve) => setTimeout(resolve, 3000)) // "thinking time"
      await move(stateAfterPush, client)
    },
  }
}

async function push(_gameState: t.ClientGameState, client: Client) {
  // Turn the extra piece randomly
  await client.serverRpc.setExtraPieceRotation(
    assertDefined(_.sample<t.Rotation>([0, 90, 180, 270]))
  )

  const pushPos = assertDefined(_.sample(BOARD_PUSH_POSITIONS))
  await client.serverRpc.push(pushPos)
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
  await client.serverRpc.move(newPos)
}
