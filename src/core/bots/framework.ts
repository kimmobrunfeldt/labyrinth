import _ from 'lodash'
import { availableBots, BotId } from 'src/core/bots/availableBots'
import {
  Client as PeerJsClient,
  ClientOptions,
  createClient as createPeerJsClient,
} from 'src/core/client/peerjsClient'
import {
  Client as WebSocketClient,
  createClient as createWebSocketClient,
} from 'src/core/client/webSocketClient'
import * as t from 'src/gameTypes'
import { getLogger, getUniqueEmoji, Logger } from 'src/utils/logger'

export type BotCreateOptions = {
  logger: Logger
  client: Client
}

export type Client = PeerJsClient | WebSocketClient

export type BotImplementation = {
  onMyTurn: (
    /**
     * Get the current game state.
     */
    getState: () => t.ClientGameState
  ) => Promise<void>
  onJoin?: t.RpcProxyWithNotify<t.ClientRpcAPI>['onJoin']
  onStateChange?: t.RpcProxyWithNotify<t.ClientRpcAPI>['onStateChange']
  onPushPositionHover?: t.RpcProxyWithNotify<t.ClientRpcAPI>['onPushPositionHover']
  onMessage?: t.RpcProxyWithNotify<t.ClientRpcAPI>['onMessage']
  onServerReject?: t.RpcProxyWithNotify<t.ClientRpcAPI>['onServerReject']
}

const params = new URLSearchParams(window.location.search)
const parsed = parseInt(params.get('botDelay') ?? '', 10)
export const BOT_THINKING_DELAY = _.isFinite(parsed) ? parsed : 5000

/**
 * Provides a framework for making new bots easier.
 */
export async function connectBot(
  botId: BotId,
  playerId: string,
  serverPeerId: string,
  wsUrl?: string
) {
  const botImplementation = availableBots[botId]
  if (!botImplementation) {
    throw new Error(`No such bot '${botId}' in available bots.`)
  }

  let gameState: t.ClientGameState
  let turnsReacted = new Set<t.ClientGameState['turnCounter']>()
  const emoji = getUniqueEmoji()
  const logger = getLogger(`${emoji} BOT (${botId}):`) // eslint-disable-line no-irregular-whitespace

  const clientCommonProps: Omit<
    ClientOptions,
    | 'serverPeerId'
    | 'onPeerError'
    | 'onPeerConnectionClose'
    | 'onPeerConnectionOpen'
    | 'onPeerConnectionError'
  > = {
    playerId,
    playerName: botImplementation.name,
    logger,
    rpcLogger: getLogger(`${emoji} BOT RPC (${botId}):`), // eslint-disable-line no-irregular-whitespace
    onJoin: async (state) => {
      logger.log('Joined server')
      gameState = state

      if (bot.onJoin) {
        await bot.onJoin(state)
      }
    },
    onStateChange: async (state) => {
      if (gameState && gameState.stage !== state.stage) {
        // Reset turn reaction memory when game is restarted
        turnsReacted = new Set<t.ClientGameState['turnCounter']>()
      }
      gameState = state

      if (bot.onStateChange) {
        await bot.onStateChange(state)
      }

      const isPlaying = gameState.stage === 'playing'
      const playerInTurn = state.players[state.playerTurn]
      const isOurTurn = playerInTurn.id === state.me.id
      const hasReactedAlready = turnsReacted.has(gameState.turnCounter)
      if (!isPlaying || !isOurTurn || hasReactedAlready) {
        return
      }

      // Add this before the bot's callback. To prevent this loop:
      // Bot moves -> server boardcasts the onStateChange -> bot receives this -> reacts again
      turnsReacted.add(gameState.turnCounter)

      // It's the bot's turn. Bots can add retrying if they need.
      await bot.onMyTurn(() => gameState)
    },
    onMessage: async (message) => {
      if (bot.onMessage) {
        await bot.onMessage(message)
      }
    },
    onPushPositionHover: async (message) => {
      if (bot.onPushPositionHover) {
        await bot.onPushPositionHover(message)
      }
    },
    onServerReject: async (message) => {
      if (bot.onServerReject) {
        await bot.onServerReject(message)
      }
    },
  }

  const client = wsUrl
    ? await createWebSocketClient({
        ...clientCommonProps,
        wsUrl,
      })
    : await createPeerJsClient({
        ...clientCommonProps,
        serverPeerId: serverPeerId,
      })

  const bot = await botImplementation.create({ logger, client })

  return client
}
