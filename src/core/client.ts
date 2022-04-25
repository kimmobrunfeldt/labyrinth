import MoleClient from 'mole-rpc/MoleClientProxified'
import MoleServer from 'mole-rpc/MoleServer'
import X from 'mole-rpc/X'
import Peer from 'peerjs'
import retryify from 'promise-retryify'
import * as t from 'src/gameTypes'
import { debugLevel, iceServers } from 'src/peerConfig'
import { createRecycler } from 'src/utils/recycler'
import { PeerJsTransportClient } from 'src/utils/TransportClient'
import { PeerJsTransportServer } from 'src/utils/TransportServer'
import { waitForEvent, wrapWithLogging } from 'src/utils/utils'

export type ClientOptions = {
  playerId: string
  serverPeerId: string
  onClientCreated?: (client: t.PromisifyMethods<t.ServerRpcAPI>) => void
  onPeerError?: (err: Error) => void
  onPeerConnectionError?: (err: Error) => void
  onPeerConnectionClose?: () => void
  onPeerConnectionOpen?: () => void
  onStateChange: t.PromisifyMethods<t.ClientRpcAPI>['onStateChange']
  getPush: t.PromisifyMethods<t.ClientRpcAPI>['getPush']
  getMove: t.PromisifyMethods<t.ClientRpcAPI>['getMove']
}

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
  const recycler = await createRecycler({
    factory: async () => await _createClient(opts),
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
    onStateChange: opts.onStateChange,
    getPush: opts.getPush,
    getMove: opts.getMove,
  }

  clientServer.expose(wrapWithLogging('server', clientRpcApi))
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
    setMyName: (...args) => client.setMyName(...args),
    start: (...args) => client.start(...args),
  }

  const retryClient = retryify(clientObj, {
    // 3s, 6s
    retryTimeout: (retryCount) => (retryCount + 1) * 3000,
    maxRetries: 0,
    shouldRetry: (err) => {
      return err instanceof X.RequestTimeout
    },
    beforeRetry: async (retryCount) => {
      console.log(`Retrying request to server attempt ${retryCount} ...`)
    },
    onAllFailed: (err) => {
      if (err instanceof X.RequestTimeout) {
        console.error('All retry attempts failed', err)
        console.log('Closing connection')
        conn.close()
      }
    },
  })

  return retryClient
}
