import MoleClient from 'mole-rpc/MoleClientProxified'
import MoleServer from 'mole-rpc/MoleServer'
import Peer from 'peerjs'
import { assertDefined } from 'src/core/server/board'
import {
  createGame,
  CreateGameOptions,
  GameControl,
} from 'src/core/server/game'
import { createServerNetworking } from 'src/core/server/networking'
import * as t from 'src/gameTypes'
import { PeerJsTransportClient } from 'src/utils/TransportClient'
import { PeerJsTransportServer } from 'src/utils/TransportServer'
import {
  getLogger,
  getPlayerLabel,
  getRandomAdminToken,
  sleep,
  wrapAdminMethods,
  wrapWithLogging,
} from 'src/utils/utils'

const logger = getLogger('SERVER:')

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
        getConnectedPlayers,
        sendMessage,
      }
      startServerRpcForClient({
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
          client,
          connection,
          status: 'connected',
        }
      }

      if (playerId in mutableServerState.players) {
        // Reconnected back
        setPlayer()
        // This is sending the data twice for joined player
        await mutableServerState.players[playerId].client.onJoin(
          getStateForPlayer(
            game,
            playerId,
            mutableServerState.players[playerId].status
          )
        )
        await sendStateToEveryone()
        sendMessage(
          `${getPlayerLabel(game.getPlayerById(playerId))} reconnected`
        )
        return
      }

      try {
        if (!(playerId in mutableServerState.players)) {
          setPlayer()
          game.addPlayer({ id: playerId, name: playerName }) // will also send state
          await mutableServerState.players[playerId].client.onJoin(
            getStateForPlayer(
              game,
              playerId,
              mutableServerState.players[playerId].status
            )
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

      sendMessage(`${getPlayerLabel(game.getPlayerById(playerId))} connected`)
    },
    onClientDisconnect: async (playerId) => {
      logger.log(`Player '${playerId}' disconnected`)
      if (
        !(playerId in mutableServerState.players) ||
        mutableServerState.players[playerId].status === 'toBeKicked'
      ) {
        return
      }

      const player = game.getPlayerById(playerId)
      if (game.getState().stage !== 'setup') {
        mutableServerState.players[playerId].status = 'disconnected'
        await sendStateToEveryone()
      } else {
        delete mutableServerState.players[playerId]
        game.removePlayer(playerId)
      }

      sendMessage(`${getPlayerLabel(player)} disconnected`)
    },
  })

  function getConnectedPlayers(): Record<
    string,
    t.ServerPlayerWithStatus<'connected'>
  > {
    const connected: Record<string, t.ServerPlayerWithStatus<'connected'>> = {}
    Object.keys(mutableServerState.players).forEach((playerId) => {
      if (mutableServerState.players[playerId].status === 'connected') {
        connected[playerId] = mutableServerState.players[
          playerId
        ] as t.ServerPlayerWithStatus<'connected'>
      }
    })
    return connected
  }

  async function sendStateToEveryone() {
    await Promise.all(
      Object.keys(getConnectedPlayers()).map((playerId) => {
        const clientGameState = getStateForPlayer(game, playerId, 'connected')
        const playerRpcClient =
          mutableServerState.players[playerId as keyof t.ServerState['players']]
            .client
        return playerRpcClient.onStateChange(clientGameState)
      })
    )
  }

  async function sendMessage(msg: string, opts: t.MessageFormatOptions = {}) {
    return Promise.all(
      Object.keys(getConnectedPlayers()).map((playerId) => {
        const playerRpcClient =
          mutableServerState.players[playerId as keyof t.ServerState['players']]
            .client
        return playerRpcClient.onMessage(msg, opts)
      })
    )
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
        sendMessage(`Skipping turn for ${game.whosTurn().name}`)
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
            `${player.name} found ${currentCardsStart[0].trophy}! ⭐️`,
            { bold: true }
          )
        }

        logger.log('Player', player.name, 'has finished their turn')
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
    throw new Error(`Turn timeout for player ${player.name}`)
  }

  return {
    peerId: network.peerId,
    adminToken,
  }
}

function startServerRpcForClient({
  connection,
  adminToken,
  game,
  playerId,
  mutableServerState,
  serverMethods,
}: {
  connection: Peer.DataConnection
  adminToken: string
  game: GameControl
  playerId: string
  mutableServerState: t.ServerState
  serverMethods: t.ServerMethods
}) {
  const server = new MoleServer({
    transports: [],
  })
  const serverRpc: t.PromisifyMethods<t.ServerRpcAPI> = {
    getState: async () =>
      getStateForPlayer(
        game,
        playerId,
        mutableServerState.players[playerId].status
      ),
    getMyPosition: async () => game.getPlayerPosition(playerId),
    getMyCurrentCards: async () => game.getPlayersCurrentCards(playerId),
    setExtraPieceRotation: async (rotation: t.Rotation) =>
      game.setExtraPieceRotationByPlayer(playerId, rotation),
    setPushPositionHover: async (position?: t.Position) => {
      if (!game.isPlayersTurn(playerId)) {
        throw new Error(
          `It's not ${playerId}'s turn. Ignoring push position hover.`
        )
      }

      // Forward the information directly to all other clients
      Object.keys(serverMethods.getConnectedPlayers()).forEach((pId) => {
        if (playerId === pId) {
          // Don't send to the client itself
          return
        }

        mutableServerState.players[
          pId as keyof typeof mutableServerState.players
        ].client.onPushPositionHover(position)
      })
    },
    setMyName: async (name: string) => game.setNameByPlayer(playerId, name),
    move: async (moveTo: t.Position) => game.moveByPlayer(playerId, moveTo),
    push: async (pushPos: t.PushPosition) =>
      game.pushByPlayer(playerId, pushPos),
    ...wrapAdminMethods(
      {
        start: serverMethods.start,
        restart: serverMethods.restart,
        promote: async () => game.promotePlayer(playerId),
        shuffleBoard: async (level?: t.ShuffleLevel) => {
          game.shuffleBoard(level)
        },
        removePlayer: async (id: t.Player['id']) => {
          logger.log(`Player '${playerId}' will be kicked`)

          const player = game.getPlayerById(id)
          if (id in mutableServerState.players) {
            mutableServerState.players[id].status = 'toBeKicked'
            await mutableServerState.players[id].client.onServerReject(
              'host kicked you out'
            )
            mutableServerState.players[id].connection.close()
            delete mutableServerState.players[id]
          }

          game.removePlayer(id)
          serverMethods.sendMessage(
            `${getPlayerLabel(player)} disconnected (kicked)`
          )
        },
        changeSettings: async (settings: Partial<t.GameSettings>) => {
          game.changeSettings(settings)
        },
      },
      adminToken
    ),
  }
  const rpcLogger = getLogger(`SERVER RPC (${playerId}):`)
  server.expose(wrapWithLogging(rpcLogger, serverRpc))
  server.registerTransport(
    new PeerJsTransportServer({
      peerConnection: connection,
    })
  )
  return server
}

function getStateForPlayer(
  game: GameControl,
  playerId: string,
  playerConnectionStatus: t.InternalPlayerConnectionStatus
): t.ClientGameState {
  function censorPlayer({
    cards: playerCards,
    ...p
  }: t.Player): t.CensoredPlayer {
    return {
      ...p,
      censoredCards: playerCards.map(
        (c): t.CensoredCard =>
          c.found ? { found: true, trophy: c.trophy } : { found: false }
      ),
      currentCards: game.getPlayersCurrentCards(p.id),
    }
  }

  const { cards: _allGameCards, board, ...state } = game.getState()
  return {
    ...state,
    board: {
      pieces: board.pieces.map((row) =>
        row.map((p) => {
          if (!p) {
            return p
          }
          const { players, ...rest } = p
          return {
            ...rest,
            players: players.map(censorPlayer),
          }
        })
      ),
    },
    players: state.players.map((p) => ({
      ...censorPlayer(p),
      status: (playerConnectionStatus === 'toBeKicked'
        ? 'disconnected'
        : playerConnectionStatus) as t.PlayerConnectionStatus,
    })),
    me: censorPlayer(game.getPlayerById(playerId)),
    myCurrentCards: game.getPlayersCurrentCards(playerId),
    myPosition:
      game.getState().stage === 'setup'
        ? undefined
        : game.getPlayerPosition(playerId),
  }
}
