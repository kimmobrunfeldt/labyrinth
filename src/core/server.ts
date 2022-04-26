import _ from 'lodash'
import MoleClient from 'mole-rpc/MoleClientProxified'
import MoleServer from 'mole-rpc/MoleServer'
import Peer, { DataConnection } from 'peerjs'
import { createGame, CreateGameOptions } from 'src/core/game'
import * as t from 'src/gameTypes'
import { debugLevel, iceServers } from 'src/peerConfig'
import { createRecycler } from 'src/utils/recycler'
import { PeerJsTransportClient } from 'src/utils/TransportClient'
import { PeerJsTransportServer } from 'src/utils/TransportServer'
import {
  getRandomAdminToken,
  sleep,
  waitForEvent,
  wrapWithLogging,
} from 'src/utils/utils'

export const TURN_TIMEOUT_SECONDS = 60
export const CHECK_TURN_END_INTERVAL_SECONDS = 0.5

export type GameServer = {
  peerId: string
  adminToken: string
}

export async function createServer(
  opts: CreateGameOptions & { peerId?: string } = {}
): Promise<GameServer> {
  const { peerId, ...gameOpts } = opts
  const game = createGame({ ...gameOpts, onStateChange: sendStateToEveryone })
  const adminToken = getRandomAdminToken()
  const players: Record<
    string,
    {
      client: t.PromisifyMethods<t.ClientRpcAPI>
      connection: DataConnection
      status: 'connected' | 'disconnected'
    }
  > = {}

  const network = await createServerNetworking({
    peerId,
    onClientConnect: (playerId, connection) => {
      console.log(`Player '${playerId}' connected`)
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
          Object.keys(players).forEach((pId) => {
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
          { start, promote: async () => game.promotePlayer(playerId) },
          adminToken
        ),
      }
      server.expose(wrapWithLogging(`Game client ${playerId}`, serverRpc))
      server.registerTransport(
        new PeerJsTransportServer({
          peerConnection: connection,
        })
      )
      const client = new MoleClient({
        requestTimeout: 60 * 1000,
        transport: new PeerJsTransportClient({ peerConnection: connection }),
      })
      try {
        if (!(playerId in players)) {
          game.addPlayer({ id: playerId })
        }
      } catch (err) {
        // Close connection max players joined
        console.warn('Client join failed:', err)
        connection.close()
        return
      }

      players[playerId] = {
        client,
        connection,
        status: 'connected',
      }
    },
    onClientDisconnect: async (playerId) => {
      console.log(`Player '${playerId}' disconnected`)

      if (playerId in players) {
        if (game.getState().stage !== 'setup') {
          players[playerId].status = 'disconnected'
        } else {
          delete players[playerId]
          game.removePlayer(playerId)

          await sendStateToEveryone()
        }
      }
    },
  })

  async function sendStateToEveryone() {
    await Promise.all(
      Object.keys(players).map((playerId) => {
        const clientGameState = getStateForPlayer(playerId)
        return players[playerId as keyof typeof players].client.onStateChange(
          clientGameState
        )
      })
    )
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
      players: state.players.map(censorPlayer),
      me: censorPlayer(game.getPlayerById(playerId)),
      myCurrentCards: game.getPlayersCurrentCards(playerId),
      myPosition:
        game.getState().stage === 'setup'
          ? undefined
          : game.getPlayerPosition(playerId),
    }
  }

  async function start() {
    game.start()
    await sendStateToEveryone()

    initiateGameLoop()
      .then(sendStateToEveryone)
      .then(() => console.log('Game finished!'))
  }

  async function initiateGameLoop() {
    while (game.getState().stage !== 'finished') {
      try {
        await turn()
      } catch (e) {
        console.warn(e)
        console.warn('Skipping turn')
        game.nextTurn()
      }
    }
  }

  async function turn() {
    const player = game.whosTurn()
    console.log('Turn by', player.name)

    for (
      let i = 0;
      i < TURN_TIMEOUT_SECONDS / CHECK_TURN_END_INTERVAL_SECONDS;
      ++i
    ) {
      await sleep(CHECK_TURN_END_INTERVAL_SECONDS * 1000)

      if (game.whosTurn().id !== player.id) {
        console.log('Player', player.name, 'has finished their turn')
        return
      }
    }

    throw new Error(`Turn timeout for player ${player.name}`)
  }

  return {
    peerId: network.peerId,
    adminToken,
  }
}

export type CreateServerNetworkingOptions = {
  peerId?: string
  onClientConnect: (id: string, connection: Peer.DataConnection) => void
  onClientDisconnect: (id: string, connection: Peer.DataConnection) => void
}

async function createServerNetworking(opts: CreateServerNetworkingOptions) {
  const recycler = await createRecycler({
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
  peer.on('error', (err) => console.error(err))
  peer.on('open', (openPeerId) => {
    console.log('Server open with peer id', openPeerId)

    peer.on('connection', (conn) => {
      const playerId = conn.metadata.id
      conn.on('open', async () => {
        opts.onClientConnect(playerId, conn)
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

function wrapAdminMethods<
  T extends { [key: string]: (...args: unknown[]) => unknown }
>(methods: T, serverAdminToken: string): T {
  return _.mapValues(methods, (fn) => {
    return (token: string, ...args: unknown[]) => {
      if (token !== serverAdminToken) {
        throw new Error('Admin command not authorized')
      }

      return fn(...args)
    }
  }) as T
}
