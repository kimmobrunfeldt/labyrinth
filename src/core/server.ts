import _ from 'lodash'
import MoleClient from 'mole-rpc/MoleClientProxified'
import MoleServer from 'mole-rpc/MoleServer'
import Peer, { DataConnection } from 'peerjs'
import { assertDefined } from 'src/core/board'
import { createGame, CreateGameOptions } from 'src/core/game'
import * as t from 'src/gameTypes'
import { debugLevel, iceServers } from 'src/peerConfig'
import { createRecycler } from 'src/utils/recycler'
import { PeerJsTransportClient } from 'src/utils/TransportClient'
import { PeerJsTransportServer } from 'src/utils/TransportServer'
import {
  getLogger,
  getRandomAdminToken,
  sleep,
  waitForEvent,
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
  const players: Record<
    string,
    {
      client: t.RpcProxy<t.ClientRpcAPI>
      connection: DataConnection
      status: 'connected' | 'disconnected' | 'toBeKicked'
    }
  > = {}
  const game = createGame({
    ...gameOpts,
    onStateChange: sendStateToEveryone,
  })
  const adminToken = getRandomAdminToken()

  const network = await createServerNetworking({
    peerId,
    onClientConnect: async (playerId, connection, playerName) => {
      logger.log(`Player '${playerName ?? playerId}' connected`)
      const server = new MoleServer({
        transports: [],
      })
      const serverRpc: t.PromisifyMethods<t.ServerRpcAPI> = {
        getState: async () => getStateForPlayer(playerId),
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
          Object.keys(getConnectedPlayers()).forEach((pId) => {
            if (playerId === pId) {
              // Don't send to the client itself
              return
            }

            players[pId as keyof typeof players].client.onPushPositionHover(
              position
            )
          })
        },
        setMyName: async (name: string) => game.setNameByPlayer(playerId, name),
        move: async (moveTo: t.Position) => game.moveByPlayer(playerId, moveTo),
        push: async (pushPos: t.PushPosition) =>
          game.pushByPlayer(playerId, pushPos),
        ...wrapAdminMethods(
          {
            start,
            restart,
            promote: async () => game.promotePlayer(playerId),
            shuffleBoard: async (level?: t.ShuffleLevel) => {
              game.shuffleBoard(level)
            },
            removePlayer: async (id: t.Player['id']) => {
              logger.log(`Player '${playerId}' will be kicked`)

              const player = game.getPlayerById(id)
              if (id in players) {
                players[id].status = 'toBeKicked'
                await players[id].client.onServerReject('host kicked you out')
                players[id].connection.close()
                delete players[id]
              }

              game.removePlayer(id)
              sendMessage(`${player.name} disconnected (kicked)`)
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
      const client: t.RpcProxy<t.ClientRpcAPI> = new MoleClient({
        requestTimeout: SERVER_TOWARDS_CLIENT_TIMEOUT_SECONDS * 1000,
        transport: new PeerJsTransportClient({
          peerConnection: connection,
        }),
      })

      async function setPlayer() {
        players[playerId] = {
          client,
          connection,
          status: 'connected',
        }
      }

      if (playerId in players) {
        // Reconnected back
        setPlayer()
        // This is sending the data twice for joined player
        await players[playerId].client.onJoin(getStateForPlayer(playerId))
        await sendStateToEveryone()
        sendMessage(`${game.getPlayerById(playerId).name} reconnected`)
        return
      }

      try {
        if (!(playerId in players)) {
          setPlayer()
          game.addPlayer({ id: playerId, name: playerName }) // will also send state
          await players[playerId].client.onJoin(getStateForPlayer(playerId))
        }
      } catch (err) {
        // Close connection max players joined
        logger.warn('Adding player failed:', err)
        delete players[playerId]
        await client.onServerReject((err as Error).message.toLowerCase())
        connection.close()
        return
      }

      sendMessage(`${game.getPlayerById(playerId).name} connected`)
    },
    onClientDisconnect: async (playerId) => {
      logger.log(`Player '${playerId}' disconnected`)
      if (!(playerId in players) || players[playerId].status === 'toBeKicked') {
        return
      }

      const player = game.getPlayerById(playerId)
      if (game.getState().stage !== 'setup') {
        players[playerId].status = 'disconnected'
        await sendStateToEveryone()
      } else {
        delete players[playerId]
        game.removePlayer(playerId)
      }

      sendMessage(`${player.name} disconnected`)
    },
  })

  function getConnectedPlayers() {
    const connected: typeof players = {}
    Object.keys(players).forEach((playerId) => {
      if (players[playerId].status === 'connected') {
        connected[playerId] = players[playerId]
      }
    })
    return connected
  }

  async function sendStateToEveryone() {
    await Promise.all(
      Object.keys(getConnectedPlayers()).map((playerId) => {
        const clientGameState = getStateForPlayer(playerId)
        return players[playerId as keyof typeof players].client.onStateChange(
          clientGameState
        )
      })
    )
  }

  async function sendMessage(msg: string) {
    Object.keys(getConnectedPlayers()).forEach((playerId) => {
      players[playerId as keyof typeof players].client.onMessage(msg)
    })
  }

  function getStateForPlayer(playerId: string): t.ClientGameState {
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
        status: (players[p.id].status === 'toBeKicked'
          ? 'disconnected'
          : players[p.id].status) as 'connected' | 'disconnected',
      })),
      me: censorPlayer(game.getPlayerById(playerId)),
      myCurrentCards: game.getPlayersCurrentCards(playerId),
      myPosition:
        game.getState().stage === 'setup'
          ? undefined
          : game.getPlayerPosition(playerId),
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
        sendMessage(`Skipping turn for ${game.whosTurn().name}`)
        game.nextTurn()
      }
    }
  }

  async function turn() {
    const player = game.whosTurn()
    logger.log('Turn by', player.name)
    sendMessage(`${player.name} turn`)

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
          sendMessage(`${player.name} found ${currentCardsStart[0].trophy}!`)
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

export type CreateServerNetworkingOptions = {
  peerId?: string
  onClientConnect: (
    id: string,
    connection: Peer.DataConnection,
    name?: string
  ) => void
  onClientDisconnect: (id: string, connection: Peer.DataConnection) => void
}

async function createServerNetworking(opts: CreateServerNetworkingOptions) {
  const recycler = await createRecycler({
    logger,
    factory: async () => await _createServerNetworking(opts),
    destroyer: async (current) => current.destroy(),
    autoRecycle: (newCurrent, cb) => {
      newCurrent.peer.on('disconnected', cb)
      newCurrent.peer.on('error', cb)
    },
  })

  return recycler.current
}

async function _createServerNetworking(
  opts: CreateServerNetworkingOptions
): Promise<{
  destroy: () => void
  peer: Peer
  peerId: string
}> {
  const peer = new Peer(opts.peerId, {
    debug: debugLevel,
    config: {
      iceServers,
    },
  })
  peer.on('error', (err) => logger.error(err))
  peer.on('open', (openPeerId) => {
    logger.log('Server open with peer id', openPeerId)

    peer.on('connection', (conn) => {
      const playerId = conn.metadata.id
      const playerName = conn.metadata.name

      conn.on('open', async () => {
        opts.onClientConnect(playerId, conn, playerName)
      })
      conn.on('close', () => {
        opts.onClientDisconnect(playerId, conn)
      })
    })
  })

  const [openedPeerId] = (await waitForEvent(peer, 'open')) as [string]
  if (!openedPeerId) {
    throw new Error('Unexpected undefined for openedPeerId')
  }

  return {
    destroy: () => peer.destroy(),
    peer,
    peerId: openedPeerId,
  }
}

function wrapAdminMethods<T extends { [key: string]: (...args: any[]) => any }>(
  methods: T,
  serverAdminToken: string
): {
  [K in keyof T]: (token: string, ...args: Parameters<T[K]>) => ReturnType<T[K]>
} {
  return _.mapValues(methods, (fn) => {
    return (token: string, ...args: any[]) => {
      if (token !== serverAdminToken) {
        throw new Error('Admin command not authorized')
      }

      return fn(...args)
    }
  })
}
