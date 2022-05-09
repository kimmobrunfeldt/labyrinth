import MoleClient from 'mole-rpc/MoleClientProxified'
import MoleServer from 'mole-rpc/MoleServer'
import Peer from 'peerjs'
import * as t from 'src/gameTypes'
import { debugLevel, iceServers } from 'src/peerConfig'
import { getLogger, Logger } from 'src/utils/logger'
import { createRecycler } from 'src/utils/recycler'
import { PeerJsTransportClient } from 'src/utils/TransportClient'
import { PeerJsTransportServer } from 'src/utils/TransportServer'
import { waitForEvent, wrapWithLogging } from 'src/utils/utils'

export const SERVER_TOWARDS_CLIENT_TIMEOUT_SECONDS = 10

/**
 * Each server protocol connection must implement this adapter API. This allows
 * the server to have a standard API for each protocol type.
 */
export type Connection = {
  disconnect: () => void
}

export type ConnectionMetadata = {
  playerId: string
  playerName?: string
}

export type CreateServerNetworkingOptions = {
  logger: Logger
  peerId?: string
  onClientConnect: (
    connection: Connection,
    clientRpc: t.RpcProxyWithNotify<t.ClientRpcAPI>,
    meta: ConnectionMetadata
  ) => Promise<t.RpcProxy<t.ServerRpcAPI>>
  onClientDisconnect: (meta: ConnectionMetadata) => void
}

export type ServerNetworking = {
  peerId: string
}

export async function createServerNetworking(
  opts: CreateServerNetworkingOptions
): Promise<ServerNetworking> {
  const peerJs = await createPeerJsNetworking(opts)

  return {
    peerId: peerJs.peerId,
  }
}

async function createPeerJsNetworking(opts: CreateServerNetworkingOptions) {
  const recycler = await createRecycler({
    logger: opts.logger,
    factory: async () => await _createPeerJsNetworking(opts),
    destroyer: async (current) => current.destroy(),
    autoRecycle: (newCurrent, cb) => {
      newCurrent.peer.on('disconnected', cb)
      newCurrent.peer.on('error', cb)
    },
  })

  return recycler.current
}

async function _createPeerJsNetworking(
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
  peer.on('error', (err) => opts.logger.error(err))
  peer.on('open', (openPeerId) => {
    opts.logger.log('Server open with peer id', openPeerId)

    peer.on('connection', (conn) => {
      const playerId = conn.metadata.id
      const playerName = conn.metadata.name

      async function onConnectionOpen() {
        const clientRpc: t.RpcProxyWithNotify<t.ClientRpcAPI> = new MoleClient({
          requestTimeout: SERVER_TOWARDS_CLIENT_TIMEOUT_SECONDS * 1000,
          transport: new PeerJsTransportClient({
            peerConnection: conn,
          }),
        })

        const serverRpc = await opts.onClientConnect(
          { disconnect: () => conn.close() },
          clientRpc,
          {
            playerId,
            playerName,
          }
        )
        const server = new MoleServer({
          transports: [],
        })
        const rpcLogger = getLogger(`SERVER RPC (${playerId}):`)
        server.expose(wrapWithLogging(rpcLogger, serverRpc))
        server.registerTransport(
          new PeerJsTransportServer({
            peerConnection: conn,
          })
        )
      }

      conn.on('open', async () => {
        try {
          await onConnectionOpen()
        } catch (err) {
          conn.close()
        }
      })

      conn.on('close', () => {
        opts.onClientDisconnect({ playerId, playerName })
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

/*

export type CreateServerTcpNetworkingOptions = {
  logger: Logger
  onClientConnect: (id: string, connection: any) => void
  onClientDisconnect: (id: string, connection: any) => void
}

export async function createServerTcpNetworking(
  opts: CreateServerTcpNetworkingOptions
) {
  const recycler = await createRecycler({
    logger: opts.logger,
    factory: async () => await _createServerTcpNetworking(opts),
    destroyer: async (current) => current.destroy(),
    autoRecycle: (newCurrent, cb) => {
      newCurrent.peer.on('disconnected', cb)
      newCurrent.peer.on('error', cb)
    },
  })

  return recycler.current
}

async function _createServerTcpNetworking(
  opts: CreateServerTcpNetworkingOptions
): Promise<{
  destroy: () => void
  peer: Peer
  peerId: string
}> {
  // create server transport
  const serverTransport = new TcpTransportServer({ port: 6653 })
  // create server
  const server = new MoleServer({ transports: [serverTransport] })
  // close server transport
  await serverTransport.close()

  const peer = new Peer(opts.peerId, {
    debug: debugLevel,
    config: {
      iceServers,
    },
  })
  peer.on('error', (err) => opts.logger.error(err))
  peer.on('open', (openPeerId) => {
    opts.logger.log('Server open with peer id', openPeerId)

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
*/
