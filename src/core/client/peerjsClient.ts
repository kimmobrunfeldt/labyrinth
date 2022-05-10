import _ from 'lodash'
import MoleClient from 'mole-rpc/MoleClientProxified'
import MoleServer from 'mole-rpc/MoleServer'
import X from 'mole-rpc/X'
import Peer from 'peerjs'
import retryify from 'promise-retryify'
import { CLIENT_TOWARDS_SERVER_TIMEOUT_SECONDS } from 'src/core/server/networking/utils'
import * as t from 'src/gameTypes'
import { debugLevel, iceServers } from 'src/peerConfig'
import { getLogger, getUniqueEmoji, Logger } from 'src/utils/logger'
import { PeerJsTransportClient } from 'src/utils/mole-rpc/PeerJsTransportClient'
import { PeerJsTransportServer } from 'src/utils/mole-rpc/PeerJsTransportServer'
import { createRecycler, Recycler } from 'src/utils/recycler'
import { waitForEvent, wrapWithLogging } from 'src/utils/utils'

export type ClientOptions = {
  playerId: string
  playerName?: string
  serverPeerId: string
  onPeerError?: (err: Error) => void
  onPeerConnectionError?: (err: Error) => void
  onPeerConnectionClose?: () => void
  onPeerConnectionOpen?: () => void
  onJoin: t.RpcProxyWithNotify<t.ClientRpcAPI>['onJoin']
  onStateChange: t.RpcProxyWithNotify<t.ClientRpcAPI>['onStateChange']
  onPushPositionHover?: t.RpcProxyWithNotify<t.ClientRpcAPI>['onPushPositionHover']
  onMessage?: t.RpcProxyWithNotify<t.ClientRpcAPI>['onMessage']
  onServerReject?: t.RpcProxyWithNotify<t.ClientRpcAPI>['onServerReject']
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
  serverRpc: t.RpcProxyWithNotify<t.ServerRpcAPI>
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

  const clientRpc: t.RpcProxy<t.ClientRpcAPI> = {
    onStateChange: opts.onStateChange,
    onJoin: opts.onJoin,
    // Don't require these for bot clients
    onMessage: opts.onMessage ?? (async () => undefined),
    onPushPositionHover: opts.onPushPositionHover ?? (async () => undefined),
    onServerReject: opts.onServerReject ?? (async () => undefined),
  }
  clientServer.expose(wrapWithLogging(opts.rpcLogger, clientRpc))
  clientServer.registerTransport(
    new PeerJsTransportServer({ peerConnection: conn })
  )

  const client: t.RpcProxyWithNotify<t.ServerRpcAPI> = new MoleClient({
    requestTimeout: CLIENT_TOWARDS_SERVER_TIMEOUT_SECONDS * 1000,
    transport: new PeerJsTransportClient({
      peerConnection: conn,
    }),
  })
  // Re-create the proxified functions for retryify to work
  const clientObj: Omit<t.RpcProxyWithNotify<t.ServerRpcAPI>, 'notify'> = {
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
    sendMessage: (...args) => client.sendMessage(...args),
    shuffleBoard: (...args) => client.shuffleBoard(...args),
    removePlayer: (...args) => client.removePlayer(...args),
    changeSettings: (...args) => client.changeSettings(...args),
  }

  const retryOptions: Parameters<typeof retryify>[1] = {
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
  }
  const retryClient = retryify(clientObj, retryOptions)
  const notifyObj = _.mapValues(clientObj, (val, key) => {
    return client.notify[key as keyof typeof client.notify]
  }) as t.RpcProxy<t.ServerRpcAPI>

  return {
    ...retryClient,
    notify: retryify(notifyObj, retryOptions),
  }
}
