import { BotCreateOptions, BotImplementation } from 'src/core/bots/framework'
import * as t from 'src/gameTypes'

/**
 * This will be shown in the admin panel drop down.
 */
export const name = 'Example bot'

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
 */
export function create({
  logger,
  client,
}: BotCreateOptions): BotImplementation {
  /**
   * The only required function to implement. The bot must first push and then move.
   */
  async function onMyTurn(getState: () => t.ClientGameState) {
    logger.info('onMyTurn', getState())

    client.serverRpc.push({ x: 1, y: 0, direction: 'down' })

    const stateAfterPush = getState()
    client.serverRpc.move({ x: 0, y: 0 })

    // The bot has access to the Server's RPC API. Most of the info is already
    // within the game state. It's can be significantly slower to request the info
    // from the game server vs calculating locally from the state.
    // Few examples:
    const myCurrentCards = await client.serverRpc.getMyCurrentCards()
    await client.serverRpc.setExtraPieceRotation(90)
    await client.serverRpc.setPushPositionHover({
      x: 1,
      y: 0,
    })
    const myPos = await client.serverRpc.getMyPosition()
    const stateNow = await client.serverRpc.getState()
  }

  /**
   * React to game state change. The bot can store previous states in memory etc.
   */
  async function onStateChange(state: t.ClientGameState) {
    logger.info('onStateChange', state)
  }

  /**
   * React to server joining. The bot can for example send a hello message.
   */
  async function onJoin(state: t.ClientGameState) {
    logger.info('onJoin', state)
  }

  /**
   * React to server message. It can be a server notice or a message by player.
   */
  async function onMessage(message: string) {
    logger.info('onMessage', message)
  }

  /**
   * React to others hovering a push position. Not sure why but could be
   * useful for sending trolling messages as the bot.
   * Note: server only deals with board coordinates. The board grid is 1 slot
   *       smaller on each side, because the UI has the push position placeholders.
   */
  async function onPushPositionHover(position?: t.Position) {
    logger.info('onPushPositionHover', position)
  }

  /**
   * React to server rejection message. Happens when e.g. server is full.
   * This means the bot client will be forcefully shut down.
   * There's nothing the bot can do about it.
   */
  async function onServerReject(message: string) {
    logger.info('onServerReject', message)
  }

  return {
    onMyTurn,
    onJoin,
    onStateChange,
    onMessage,
    onPushPositionHover,
    onServerReject,
  }
}
