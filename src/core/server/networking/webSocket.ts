import MoleClient from 'mole-rpc/MoleClientProxified'
import MoleServer from 'mole-rpc/MoleServer'
import {
  ConnectionMetadata,
  CreateServerNetworkingOptions,
  SERVER_TOWARDS_CLIENT_TIMEOUT_SECONDS,
} from 'src/core/server/networking/utils'
import * as t from 'src/gameTypes'
import { getLogger } from 'src/utils/logger'
import { WebSocketTransportClient } from 'src/utils/mole-rpc/WebSocketTransportClient'
import { WebSocketTransportServer } from 'src/utils/mole-rpc/WebSocketTransportServer'
import { createRecycler } from 'src/utils/recycler'
import { wrapWithLogging } from 'src/utils/utils'
import { WebSocketServer } from 'ws'

export async function createServerWebSocketNetworking(
  opts: CreateServerNetworkingOptions
) {
  const recycler = await createRecycler({
    logger: opts.logger,
    factory: async () => await _createServerNetworking(opts),
    destroyer: async (current) => current.destroy(),
    autoRecycle: (newCurrent, cb) => {
      newCurrent.wss.on('error', cb)
    },
  })

  return recycler.current
}

async function _createServerNetworking(
  opts: CreateServerNetworkingOptions
): Promise<{
  destroy: () => void
  wss: WebSocketServer
}> {
  const wss = new WebSocketServer({
    port: opts.serverWebSocketPort,
  })
  opts.logger.info(
    `WebSocket server listening at ws://localhost:${opts.serverWebSocketPort}`
  )
  /**
   * After connection has been established, client should send metadata as a JSON,
   * followed by a newline. After this initial exchange, all communication happens
   * as JSON RPC.
   */
  wss.on('connection', (ws) => {
    opts.logger.info('New websocket connection, waiting for metadata ...')
    const timer = setTimeout(() => {
      ws.send('Initial metadata not received, closing connection.')
      ws.close()
    }, 5000)
    ws.once('message', (metadata) => {
      clearTimeout(timer)
      onConnectionOpen(JSON.parse(metadata.toString()))
    })

    async function onConnectionOpen(meta: ConnectionMetadata) {
      const clientRpc: t.RpcProxyWithNotify<t.ClientRpcAPI> = new MoleClient({
        requestTimeout: SERVER_TOWARDS_CLIENT_TIMEOUT_SECONDS * 1000,
        transport: new WebSocketTransportClient({
          ws,
        }),
      })

      const serverRpc = await opts.onClientConnect(
        { disconnect: () => ws.close() },
        clientRpc,
        meta
      )
      const server = new MoleServer({
        transports: [],
      })
      const rpcLogger = getLogger(`SERVER RPC (${meta.playerId}):`)
      server.expose(wrapWithLogging(rpcLogger, serverRpc))
      server.registerTransport(
        new WebSocketTransportServer({
          ws,
        })
      )
    }
  })

  return {
    destroy: () => wss.close(),
    wss,
  }
}
