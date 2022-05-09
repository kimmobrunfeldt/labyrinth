import { assertDefined } from 'src/core/server/board'
import { createGame, CreateGameOptions } from 'src/core/server/game'
import { createServerNetworking } from 'src/core/server/networking/networking'
import {
  Connection,
  ConnectionMetadata,
} from 'src/core/server/networking/utils'
import { createServerRpc, getStateForPlayer } from 'src/core/server/serverRpc'
import * as t from 'src/gameTypes'
import { getLogger } from 'src/utils/logger'
import { getPlayerLabel, getRandomAdminToken, sleep } from 'src/utils/utils'

const logger = getLogger('📓 SERVER:')

export const TURN_TIMEOUT_SECONDS = 90
export const CHECK_TURN_END_INTERVAL_SECONDS = 0.5

export type GameServer = {
  peerId: string
  adminToken: string
}

export async function createServer(
  opts: CreateGameOptions & {
    serverPeerId: string
    serverWebSocketPort: number
    adminToken?: string
  }
): Promise<GameServer> {
  const {
    serverPeerId,
    serverWebSocketPort,
    adminToken: adminTokenInput,
    ...gameOpts
  } = opts
  // Will be mutated later
  const serverState: t.ServerState = {
    players: {},
  }
  const game = createGame({
    ...gameOpts,
    onStateChange: sendStateToEveryone,
  })
  const adminToken = adminTokenInput ? adminTokenInput : getRandomAdminToken()
  logger.info(`Using admin token ${adminToken}`)
  const networking = await createServerNetworking({
    logger,
    serverPeerId,
    serverWebSocketPort,
    onClientConnect: handleClientConnect,
    onClientDisconnect: handleClientDisconnect,
  })

  return {
    peerId: networking.peerId,
    adminToken,
  }

  // Server internal functions

  async function handleClientConnect(
    connection: Connection,
    clientRpc: t.RpcProxyWithNotify<t.ClientRpcAPI>,
    meta: ConnectionMetadata
  ): Promise<t.RpcProxy<t.ServerRpcAPI>> {
    const { playerId, playerName } = meta

    logger.log(`Player '${playerName ?? playerId}' connected`)
    const serverMethods: t.ServerMethods = {
      start,
      restart,
      makeSpectator,
      sendMessage,
      getConnectedPlayers: () => getPlayersWithStatus('connected'),
    }
    const serverRpc = createServerRpc({
      logger,
      adminToken,
      game,
      playerId,
      serverState,
      serverMethods,
    })

    if (playerId in serverState.players) {
      // Reconnected back
      setServerPlayer(playerId, connection, clientRpc)

      // Use .notify to not wait for a reply. At this stage the serverRpc is not yet
      // setup for listening
      await clientRpc.notify.onJoin(
        getStateForPlayer(game, serverState.players, playerId)
      )
      await sendStateToEveryone()
      sendMessage(
        `${getPlayerLabel(game.maybeGetPlayerById(playerId))} reconnected`
      )
      return serverRpc
    }

    try {
      if (!(playerId in serverState.players)) {
        setServerPlayer(playerId, connection, clientRpc)
        // will also send state to everyone
        game.addPlayer({ id: playerId, name: playerName })
      }
    } catch (err) {
      // Close connection max players joined
      logger.warn('Adding player failed:', err)
      delete serverState.players[playerId]
      await clientRpc.onServerReject((err as Error).message.toLowerCase())
      throw err
    }

    // Use .notify to not wait for a reply. At this stage the serverRpc is not yet
    // setup for listening
    await clientRpc.notify.onJoin(
      getStateForPlayer(game, serverState.players, playerId)
    )
    sendMessage(
      `${getPlayerLabel(game.maybeGetPlayerById(playerId))} connected`
    )
    return serverRpc
  }

  async function handleClientDisconnect({ playerId }: ConnectionMetadata) {
    logger.log(`Player '${playerId}' disconnected`)
    if (
      !(playerId in serverState.players) ||
      serverState.players[playerId].status === 'toBeKicked'
    ) {
      return
    }

    const serverPlayer = serverState.players[playerId]
    // Get player details before they are removed from game
    const player = game.maybeGetPlayerById(playerId)

    if (game.getState().stage !== 'setup') {
      serverState.players[playerId].status = 'disconnected'
      await sendStateToEveryone()
    } else {
      delete serverState.players[playerId]
      if (!serverPlayer.spectator) {
        game.removePlayer(playerId)
      }
    }

    sendMessage(`${getPlayerLabel(player)} disconnected`)
  }

  function setServerPlayer(
    playerId: string,
    connection: Connection,
    playerRpc: t.RpcProxyWithNotify<t.ClientRpcAPI>
  ) {
    serverState.players[playerId] = {
      id: playerId,
      clientRpc: playerRpc,
      connection,
      status: 'connected',
      spectator: serverState.players[playerId]?.spectator ?? false,
    }
  }

  function getPlayersWithStatus<
    T extends t.InternalPlayerConnectionStatus = t.InternalPlayerConnectionStatus
  >(status?: T): Record<string, t.ServerPlayerWithStatus<T>> {
    const playersWithStatus: Record<string, t.ServerPlayerWithStatus<T>> = {}
    Object.keys(serverState.players).forEach((playerId) => {
      if (status && serverState.players[playerId].status === status) {
        playersWithStatus[playerId] = serverState.players[
          playerId
        ] as t.ServerPlayerWithStatus<T>
      }
    })
    return playersWithStatus
  }

  async function sendStateToEveryone() {
    return forAllServerPlayers(
      (player) =>
        player.clientRpc.onStateChange(
          getStateForPlayer(game, serverState.players, player.id)
        ),
      'connected'
    )
  }

  async function sendMessage(msg: string, opts: t.MessageFormatOptions = {}) {
    return forAllServerPlayers(
      (player) => player.clientRpc.onMessage(msg, opts),
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
          ...serverState.players[playerId],
          id: playerId,
        })
      })
    )
  }

  async function makeSpectator(playerId: string) {
    serverState.players[playerId].spectator = true
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
}
