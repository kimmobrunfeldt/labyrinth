import _ from 'lodash'
import MoleClient from 'mole-rpc/MoleClientProxified'
import MoleServer from 'mole-rpc/MoleServer'
import Peer, { DataConnection } from 'peerjs'
import { createGame, CreateGameOptions } from 'src/core/game'
import { PeerJsTransportClient } from 'src/core/TransportClient'
import { PeerJsTransportServer } from 'src/core/TransportServer'
import * as t from 'src/core/types'
import {
  getRandomAdminToken,
  getRandomPeerId,
  loopUntilSuccess,
  wrapWithLogging,
} from 'src/core/utils'

export type GameServer = {
  peerId: string
  adminToken: string
}

export async function createServer(
  gameOpts: CreateGameOptions = {}
): Promise<GameServer> {
  const game = createGame({ ...gameOpts, onStateChange: sendStateToEveryone })
  const adminToken = getRandomAdminToken()
  const players: Record<
    string,
    {
      client: t.PromisifyMethods<t.PlayerRpcAPI>
      connection: DataConnection
      status: 'connected' | 'disconnected'
    }
  > = {}

  const peerId = getRandomPeerId()
  const peer = new Peer('mouse-ghost-779', {
    debug: 10,
  })
  peer.on('error', (err) => console.error(err))

  async function sendStateToEveryone() {
    await Promise.all(
      Object.keys(players).map((playerId) => {
        const clientGameState = getStateForPlayer(playerId)
        players[playerId as keyof typeof players].client.onStateChange(
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

    const { cards: _allGameCards, ...state } = game.getState()
    return {
      ...state,
      players: state.players.map(censorPlayer),
      me: censorPlayer(game.getPlayerById(playerId)),
      myCurrentCards: game.getPlayersCurrentCards(playerId),
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
      console.log('game loop tick')
      try {
        await turn()
        await new Promise((resolve) => setTimeout(resolve, 1000))
      } catch (e) {
        await new Promise((resolve) => setTimeout(resolve, 100))
        console.warn('Skipping turn')
        game.nextTurn()
      }
    }
  }

  async function turn() {
    const player = game.whosTurn()
    console.log('turn by', player.name)
    await loopUntilSuccess(
      async () => {
        console.log('push by', player.name)
        const playerPush = await players[
          player.id as keyof typeof players
        ].client.getPush()

        game.pushByPlayer(player.id, playerPush)
      },
      { onError: (err) => console.warn('player push failed', err) }
    )

    await loopUntilSuccess(
      async () => {
        console.log('move by', player.name)
        const moveTo = await players[
          player.id as keyof typeof players
        ].client.getMove()

        game.moveByPlayer(player.id, moveTo)
      },
      { onError: (err) => console.warn('player move failed', err) }
    )

    await loopUntilSuccess(sendStateToEveryone, {
      onError: (err) => console.warn('send state to everyone failed:', err),
    })
  }

  return new Promise((resolve) => {
    peer.on('open', (openPeerId) => {
      console.log('Server open')

      peer.on('connection', (conn) => {
        const playerId = conn.metadata.id
        console.log(`Player '${playerId}' connected`)

        conn.on('open', async () => {
          // TODO: No clear separation between server protocol and game logic
          const server = new MoleServer({
            transports: [],
          })
          const serverRpc: t.PromisifyMethods<t.ServerRpcAPI> = {
            getState: async () => getStateForPlayer(playerId),
            getMyPosition: async () => game.getPlayerPosition(playerId),
            getMyCurrentCards: async () =>
              game.getPlayersCurrentCards(playerId),
            setExtraPieceRotation: async (rotation: t.Rotation) =>
              game.setExtraPieceRotationByPlayer(playerId, rotation),
            setMyName: async (name: string) =>
              game.setNameByPlayer(playerId, name),
            ...wrapAdminMethods({ start }, adminToken),
          }
          server.expose(wrapWithLogging(playerId, serverRpc))
          server.registerTransport(
            new PeerJsTransportServer({
              peerConnection: conn,
            })
          )
          const client = new MoleClient({
            requestTimeout: 60 * 1000,
            transport: new PeerJsTransportClient({ peerConnection: conn }),
          })
          try {
            game.addPlayer({ id: playerId })
          } catch (err) {
            // Close connection max players joined
            console.warn('Client join failed:', err)
            conn.close()
            return
          }

          players[playerId] = {
            client,
            connection: conn,
            status: 'connected',
          }
        })

        conn.on('close', () => {
          // XXX: Memory-leak sensitive
          console.log('Client connection closed')
          if ('playerId' in players) {
            if (game.getState().stage !== 'setup') {
              players[playerId].status = 'disconnected'
            } else {
              delete players[playerId]
              game.removePlayer(playerId)
            }
          }
        })
      })

      resolve({ peerId: openPeerId, adminToken })
    })
  })
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
