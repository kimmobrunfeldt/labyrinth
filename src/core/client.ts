import MoleClient from 'mole-rpc/MoleClientProxified'
import MoleServer from 'mole-rpc/MoleServer'
import X from 'mole-rpc/X'
import Peer from 'peerjs'
import retryify from 'promise-retryify'
import { SERVER_TOWARDS_CLIENT_TIMEOUT_SECONDS } from 'src/core/server/server'
import * as t from 'src/gameTypes'
import { debugLevel, iceServers } from 'src/peerConfig'
import { getLogger, getUniqueEmoji, Logger } from 'src/utils/logger'
import { createRecycler, Recycler } from 'src/utils/recycler'
import { PeerJsTransportClient } from 'src/utils/TransportClient'
import { PeerJsTransportServer } from 'src/utils/TransportServer'
import { waitForEvent, wrapWithLogging } from 'src/utils/utils'

export type ClientOptions = {
  playerId: string
  playerName?: string
  serverPeerId: string
  onPeerError?: (err: Error) => void
  onPeerConnectionError?: (err: Error) => void
  onPeerConnectionClose?: () => void
  onPeerConnectionOpen?: () => void
  onJoin: t.PromisifyMethods<t.ClientRpcAPI>['onJoin']
  onStateChange: t.PromisifyMethods<t.ClientRpcAPI>['onStateChange']
  onPushPositionHover?: t.PromisifyMethods<t.ClientRpcAPI>['onPushPositionHover']
  onMessage?: t.PromisifyMethods<t.ClientRpcAPI>['onMessage']
  onServerReject?: t.PromisifyMethods<t.ClientRpcAPI>['onServerReject']
  logger: Logger
  rpcLogger?: Logger
}

export type Client = Awaited<ReturnType<typeof createClient>>

/**
 * The caller of `createClient` needs to take extra care to only save the reference
 * to the `recycler.current` object.
 *
 * Don't do:
 *
 *   const { client } = recycler.current
 *
 * It will break the proxy mechanism without nested proxies implementation.
 */
export async function createClient(opts: ClientOptions) {
  const recycler: Recycler<Awaited<ReturnType<typeof _createClient>>> =
    await createRecycler({
      logger: opts.logger,
      factory: async () =>
        await _createClient({
          ...opts,
          rpcLogger:
            opts.rpcLogger ?? getLogger(`${getUniqueEmoji()} CLIENT RPC:`), // eslint-disable-line no-irregular-whitespace
          onServerReject: async (message) => {
            opts.logger.warn(
              'Server rejected us. Stopping client recycling ...',
              'Reason for rejection:',
              message
            )
            // Server will close the connection, so let's not do it from the client
            await recycler.stop({ destroy: false })
            opts.logger.log('Stopped.')
            opts.onServerReject && opts.onServerReject(message)
          },
        }),
      destroyer: async (current) => current.destroy(),
      autoRecycle: (newCurrent, cb) => {
        newCurrent.peer.on('disconnected', cb)
        newCurrent.peer.on('error', cb)
        newCurrent.connection.on('error', cb)
        newCurrent.connection.on('close', cb)
      },
    })

  return recycler.current
}

async function _createClient(
  opts: t.RequiredBy<ClientOptions, 'rpcLogger'>
): Promise<{
  serverRpc: t.RpcProxy<t.ServerRpcAPI>
  destroy: () => void
  peer: Peer
  connection: Peer.DataConnection
}> {
  const peer = new Peer({
    debug: debugLevel,
    config: {
      iceServers,
    },
  })
  peer.on('error', (err) => {
    opts.onPeerError && opts.onPeerError(err)
  })
  await waitForEvent(peer, 'open')

  const connection = peer.connect(opts.serverPeerId, {
    reliable: true,
    metadata: {
      id: opts.playerId,
      name: opts.playerName,
    },
  })
  await waitForEvent(connection, 'open')
  opts.onPeerConnectionOpen && opts.onPeerConnectionOpen()

  connection.on('close', () => {
    opts.onPeerConnectionClose && opts.onPeerConnectionClose()
  })
  connection.on('error', (err) => {
    opts.onPeerConnectionError && opts.onPeerConnectionError(err)
  })

  return {
    serverRpc: createRpc(connection, opts),
    destroy: () => {
      peer.destroy()
    },
    peer,
    connection,
  }
}

function createRpc(
  conn: Peer.DataConnection,
  opts: t.RequiredBy<ClientOptions, 'rpcLogger'>
) {
  // This client server listens for commands incoming from the server
  const clientServer = new MoleServer({
    transports: [],
  })

  const clientRpcApi: t.PromisifyMethods<t.ClientRpcAPI> = {
    onStateChange: opts.onStateChange,
    onJoin: opts.onJoin,
    // Don't require thesefor bot clients
    onMessage: opts.onMessage ?? (async () => undefined),
    onPushPositionHover: opts.onPushPositionHover ?? (async () => undefined),
    onServerReject: opts.onServerReject ?? (async () => undefined),
  }
  clientServer.expose(wrapWithLogging(opts.rpcLogger, clientRpcApi))
  clientServer.registerTransport(
    new PeerJsTransportServer({ peerConnection: conn })
  )

  const client: t.RpcProxy<t.ServerRpcAPI> = new MoleClient({
    // This is required to be lower than the server's timeout towards clients.
    // Think of this scenario:
    // * You send "kick player 2" to server (5s timeout)
    // * Server sends "server is full get out" to player 2 (10s timeout)
    // * Player 2 disconnects without responding
    // * ... server keeps waiting
    // * Your client times out before server responds to you -> recycle of your client
    requestTimeout: (SERVER_TOWARDS_CLIENT_TIMEOUT_SECONDS - 2) * 1000,
    transport: new PeerJsTransportClient({
      peerConnection: conn,
    }),
  })
  // Re-create the proxified functions for retryify to work
  const clientObj: Omit<t.RpcProxy<t.ServerRpcAPI>, 'notify'> = {
    getState: (...args) => client.getState(...args),
    getMyPosition: (...args) => client.getMyPosition(...args),
    getMyCurrentCards: (...args) => client.getMyCurrentCards(...args),
    setExtraPieceRotation: (...args) => client.setExtraPieceRotation(...args),
    setPushPositionHover: (...args) => client.setPushPositionHover(...args),
    setMyName: (...args) => client.setMyName(...args),
    move: (...args) => client.move(...args),
    push: (...args) => client.push(...args),
    start: (...args) => client.start(...args),
    restart: (...args) => client.restart(...args),
    promote: (...args) => client.promote(...args),
    spectate: (...args) => client.spectate(...args),
    shuffleBoard: (...args) => client.shuffleBoard(...args),
    removePlayer: (...args) => client.removePlayer(...args),
    changeSettings: (...args) => client.changeSettings(...args),
  }

  const retryClient = retryify(clientObj, {
    // 3s, 6s
    retryTimeout: (retryCount) => (retryCount + 1) * 3000,
    maxRetries: 0,
    shouldRetry: (err) => {
      return err instanceof X.RequestTimeout
    },
    beforeRetry: async (retryCount) => {
      opts.logger.log(`Retrying request to server attempt ${retryCount} ...`)
    },
    onAllFailed: (err) => {
      if (err instanceof X.RequestTimeout) {
        opts.logger.error('All retry attempts failed', err)
        opts.logger.log('Closing connection')
        conn.close()
      }
    },
  })

  const anyClient = retryClient as t.RpcProxy<t.ServerRpcAPI>
  anyClient.notify = retryClient
  return anyClient
}
