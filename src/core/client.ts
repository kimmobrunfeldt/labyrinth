import MoleClient from 'mole-rpc/MoleClientProxified'
import MoleServer from 'mole-rpc/MoleServer'
import X from 'mole-rpc/X'
import Peer from 'peerjs'
import retryify from 'promise-retryify'
import * as t from 'src/gameTypes'
import { debugLevel, iceServers } from 'src/peerConfig'
import { createRecycler, Recycler } from 'src/utils/recycler'
import { PeerJsTransportClient } from 'src/utils/TransportClient'
import { PeerJsTransportServer } from 'src/utils/TransportServer'
import {
  getLogger,
  Logger,
  waitForEvent,
  wrapWithLogging,
} from 'src/utils/utils'

export type ClientOptions = {
  playerId: string
  serverPeerId: string
  onPeerError?: (err: Error) => void
  onPeerConnectionError?: (err: Error) => void
  onPeerConnectionClose?: () => void
  onPeerConnectionOpen?: () => void
  onStateChange: t.PromisifyMethods<t.ClientRpcAPI>['onStateChange']
  onPushPositionHover?: t.PromisifyMethods<t.ClientRpcAPI>['onPushPositionHover']
  onMessage?: t.PromisifyMethods<t.ClientRpcAPI>['onMessage']
  onServerFull?: t.PromisifyMethods<t.ClientRpcAPI>['onServerFull']
  logger: Logger
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
          onServerFull: async () => {
            opts.logger.warn('Server was full! Stopping client recycling ...')
            await recycler.stop()
            opts.logger.log('Stopped.')
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

async function _createClient(opts: ClientOptions): Promise<{
  client: t.PromisifyMethods<t.ServerRpcAPI>
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
    client: createRpc(connection, opts),
    destroy: () => {
      peer.destroy()
    },
    peer,
    connection,
  }
}

function createRpc(conn: Peer.DataConnection, opts: ClientOptions) {
  // This client server listens for commands incoming from the server
  const clientServer = new MoleServer({
    transports: [],
  })

  const clientRpcApi: t.PromisifyMethods<t.ClientRpcAPI> = {
    // Don't require thesefor bot clients
    onMessage: opts.onMessage ?? (async () => undefined),
    onPushPositionHover: opts.onPushPositionHover ?? (async () => undefined),
    onStateChange: opts.onStateChange,
    onServerFull: opts.onServerFull ?? (async () => undefined),
  }
  const rpcLogger = getLogger(`CLIENT RPC:`)
  clientServer.expose(wrapWithLogging(rpcLogger, clientRpcApi))
  clientServer.registerTransport(
    new PeerJsTransportServer({ peerConnection: conn })
  )

  const client: t.PromisifyMethods<t.ServerRpcAPI> = new MoleClient({
    requestTimeout: 2000,
    transport: new PeerJsTransportClient({
      peerConnection: conn,
    }),
  })
  // Re-create the proxified functions for retryify to work
  const clientObj: t.PromisifyMethods<t.ServerRpcAPI> = {
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
    shuffleBoard: (...args) => client.shuffleBoard(...args),
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

  return retryClient
}
