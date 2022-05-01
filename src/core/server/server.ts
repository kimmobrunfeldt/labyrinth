import MoleClient from 'mole-rpc/MoleClientProxified'
import { assertDefined } from 'src/core/server/board'
import { createGame, CreateGameOptions } from 'src/core/server/game'
import { createServerNetworking } from 'src/core/server/networking'
import {
  getStateForPlayer,
  startServerRpcForClient,
} from 'src/core/server/serverRpc'
import * as t from 'src/gameTypes'
import { getLogger } from 'src/utils/logger'
import { PeerJsTransportClient } from 'src/utils/TransportClient'
import { getPlayerLabel, getRandomAdminToken, sleep } from 'src/utils/utils'

const logger = getLogger('📓 SERVER:')

export const TURN_TIMEOUT_SECONDS = 90
export const CHECK_TURN_END_INTERVAL_SECONDS = 0.5
export const SERVER_TOWARDS_CLIENT_TIMEOUT_SECONDS = 10

export type GameServer = {
  peerId: string
  adminToken: string
}

export async function createServer(
  opts: CreateGameOptions & { peerId?: string } = {}
): Promise<GameServer> {
  const { peerId, ...gameOpts } = opts
  const mutableServerState: t.ServerState = {
    players: {},
  }
  const game = createGame({
    ...gameOpts,
    onStateChange: sendStateToEveryone,
  })
  const adminToken = getRandomAdminToken()

  const network = await createServerNetworking({
    logger,
    peerId,
    onClientConnect: async (playerId, connection, playerName) => {
      logger.log(`Player '${playerName ?? playerId}' connected`)
      const serverMethods: t.ServerMethods = {
        start,
        restart,
        makeSpectator,
        sendMessage,
        getConnectedPlayers: () => getPlayersWithStatus('connected'),
      }
      startServerRpcForClient({
        logger,
        connection,
        adminToken,
        game,
        playerId,
        mutableServerState,
        serverMethods,
      })
      const client: t.RpcProxy<t.ClientRpcAPI> = new MoleClient({
        requestTimeout: SERVER_TOWARDS_CLIENT_TIMEOUT_SECONDS * 1000,
        transport: new PeerJsTransportClient({
          peerConnection: connection,
        }),
      })

      async function setPlayer() {
        mutableServerState.players[playerId] = {
          id: playerId,
          client,
          connection,
          status: 'connected',
          spectator: mutableServerState.players[playerId]?.spectator ?? false,
        }
      }

      if (playerId in mutableServerState.players) {
        // Reconnected back
        setPlayer()
        // This is sending the data twice for joined player
        await mutableServerState.players[playerId].client.onJoin(
          getStateForPlayer(game, mutableServerState.players, playerId)
        )
        await sendStateToEveryone()
        sendMessage(
          `${getPlayerLabel(game.maybeGetPlayerById(playerId))} reconnected`
        )
        return
      }

      try {
        if (!(playerId in mutableServerState.players)) {
          setPlayer()
          game.addPlayer({ id: playerId, name: playerName }) // will also send state
          await mutableServerState.players[playerId].client.onJoin(
            getStateForPlayer(game, mutableServerState.players, playerId)
          )
        }
      } catch (err) {
        // Close connection max players joined
        logger.warn('Adding player failed:', err)
        delete mutableServerState.players[playerId]
        await client.onServerReject((err as Error).message.toLowerCase())
        connection.close()
        return
      }

      sendMessage(
        `${getPlayerLabel(game.maybeGetPlayerById(playerId))} connected`
      )
    },
    onClientDisconnect: async (playerId) => {
      logger.log(`Player '${playerId}' disconnected`)
      if (
        !(playerId in mutableServerState.players) ||
        mutableServerState.players[playerId].status === 'toBeKicked'
      ) {
        return
      }

      const serverPlayer = mutableServerState.players[playerId]
      const player = game.maybeGetPlayerById(playerId)
      if (game.getState().stage !== 'setup') {
        mutableServerState.players[playerId].status = 'disconnected'
        await sendStateToEveryone()
      } else {
        delete mutableServerState.players[playerId]
        if (!serverPlayer.spectator) {
          game.removePlayer(playerId)
        }
      }

      sendMessage(`${getPlayerLabel(player)} disconnected`)
    },
  })

  function getPlayersWithStatus<
    T extends t.InternalPlayerConnectionStatus = t.InternalPlayerConnectionStatus
  >(status?: T): Record<string, t.ServerPlayerWithStatus<T>> {
    const playersWithStatus: Record<string, t.ServerPlayerWithStatus<T>> = {}
    Object.keys(mutableServerState.players).forEach((playerId) => {
      if (status && mutableServerState.players[playerId].status === status) {
        playersWithStatus[playerId] = mutableServerState.players[
          playerId
        ] as t.ServerPlayerWithStatus<T>
      }
    })
    return playersWithStatus
  }

  async function sendStateToEveryone() {
    return forAllServerPlayers(
      (player) =>
        player.client.onStateChange(
          getStateForPlayer(game, mutableServerState.players, player.id)
        ),
      'connected'
    )
  }

  async function sendMessage(msg: string, opts: t.MessageFormatOptions = {}) {
    return forAllServerPlayers(
      (player) => player.client.onMessage(msg, opts),
      'connected'
    )
  }

  /**
   * Executes a function for all server players. Done concurrently for everyone.
   */
  function forAllServerPlayers<T>(
    cb: (serverPlayer: t.ServerPlayer & { id: string }) => Promise<T>,
    status?: t.InternalPlayerConnectionStatus
  ): Promise<T[]> {
    return Promise.all(
      Object.keys(getPlayersWithStatus(status)).map((playerId) => {
        return cb({
          ...mutableServerState.players[playerId],
          id: playerId,
        })
      })
    )
  }

  async function makeSpectator(playerId: string) {
    mutableServerState.players[playerId].spectator = true
    if (game.maybeGetPlayerById(playerId)) {
      game.removePlayer(playerId)
    }
  }

  async function restart() {
    game.restart()
    await sendStateToEveryone()
  }

  async function start() {
    game.start()
    await sendStateToEveryone()

    initiateGameLoop()
      .then(sendStateToEveryone)
      .then(() => {
        sendMessage('Game finished!')
        logger.log('Game loop ended!')
      })
  }

  async function initiateGameLoop() {
    while (game.getState().stage === 'playing') {
      try {
        await turn()
      } catch (e) {
        logger.warn(e)
        logger.warn('Skipping turn')
        sendMessage(`Skipping turn for ${getPlayerLabel(game.whosTurn())}`)
        game.nextTurn()
      }
    }
  }

  async function turn() {
    const player = game.whosTurn()
    logger.log('Turn by', player.name)
    await sendMessage(`${getPlayerLabel(player)} in turn`)

    const currentCardsStart = game.getPlayersCurrentCards(player.id)
    const turnCounterNow = game.getState().turnCounter
    const secondLeftWarnings = [60, 30, 10].sort().reverse()

    for (
      let i = 0;
      i < TURN_TIMEOUT_SECONDS / CHECK_TURN_END_INTERVAL_SECONDS;
      ++i
    ) {
      await sleep(CHECK_TURN_END_INTERVAL_SECONDS * 1000)
      if (game.getState().stage === 'setup') {
        logger.log('Game has restarted!')
        return
      }

      if (game.getState().stage === 'finished') {
        logger.log('Game finished, turn ended!')
        return
      }

      if (turnCounterNow !== game.getState().turnCounter) {
        const cardsNow = game.getPlayersCurrentCards(player.id)
        if (currentCardsStart[0].trophy !== cardsNow[0]?.trophy) {
          await sendMessage(
            `${getPlayerLabel(player)} found ${
              currentCardsStart[0].trophy
            }! ⭐️`,
            { bold: true }
          )
        }

        logger.log('Player', getPlayerLabel(player), 'has finished their turn')
        return
      }

      const secondsPassed = i * CHECK_TURN_END_INTERVAL_SECONDS
      const timeLeft = TURN_TIMEOUT_SECONDS - secondsPassed
      const warning = secondLeftWarnings.find((s) => timeLeft < s)
      if (warning) {
        const first = assertDefined(secondLeftWarnings.shift())
        if (first !== warning) {
          throw new Error(`Unexpected condition`)
        }
        sendMessage(`${warning} seconds left in turn`)
      }
    }

    sendMessage(
      `Timeout for ${
        game.whosTurn().name
      } after ${TURN_TIMEOUT_SECONDS} seconds`
    )
    throw new Error(`Turn timeout for player ${getPlayerLabel(player)}`)
  }

  return {
    peerId: network.peerId,
    adminToken,
  }
}
