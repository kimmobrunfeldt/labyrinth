import MoleClient from 'mole-rpc/MoleClientProxified'
import MoleServer from 'mole-rpc/MoleServer'
import Peer from 'peerjs'
import {
  CreateServerNetworkingOptions,
  SERVER_TOWARDS_CLIENT_TIMEOUT_SECONDS,
} from 'src/core/server/networking/utils'
import * as t from 'src/gameTypes'
import { debugLevel, iceServers } from 'src/peerConfig'
import { getLogger } from 'src/utils/logger'
import { PeerJsTransportClient } from 'src/utils/mole-rpc/PeerJsTransportClient'
import { PeerJsTransportServer } from 'src/utils/mole-rpc/PeerJsTransportServer'
import { createRecycler } from 'src/utils/recycler'
import { waitForEvent, wrapWithLogging } from 'src/utils/utils'

export async function createPeerJsNetworking(
  opts: CreateServerNetworkingOptions
) {
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
  const peer = new Peer(opts.serverPeerId, {
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
