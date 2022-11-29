import _ from 'lodash'
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
import { wrapWithErrorIgnoring, wrapWithLogging } from 'src/utils/utils'
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
    // host: '0.0.0.0',
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
      const msg = 'Initial metadata not received, closing connection.'
      opts.logger.info(msg)
      ws.send(msg)
      ws.close()
    }, 5000)
    ws.once('message', (metadata) => {
      opts.logger.info('Initial metadata received', metadata.toString())
      clearTimeout(timer)
      onConnectionOpen(JSON.parse(metadata.toString()))

      ws.on('close', () =>
        opts.logger.info(
          'Client WebSocket connection closed',
          metadata.toString()
        )
      )
    })

    async function onConnectionOpen(meta: ConnectionMetadata) {
      const clientRpcLogger = getLogger(`CLIENT RPC (${meta.playerId}):`)
      const clientRpc: t.RpcProxyWithNotify<t.ClientRpcAPI> = new MoleClient({
        requestTimeout: SERVER_TOWARDS_CLIENT_TIMEOUT_SECONDS * 1000,
        transport: new WebSocketTransportClient({
          ws,
        }),
      })
      // Re-create the proxified functions for iteration to work
      const clientRpcObj: t.RpcProxy<t.ClientRpcAPI> = wrapWithLogging(
        clientRpcLogger,
        wrapWithErrorIgnoring(clientRpcLogger, {
          onJoin: (...args) => clientRpc.onJoin(...args),
          onStateChange: (...args) => clientRpc.onStateChange(...args),
          onMessage: (...args) => clientRpc.onMessage(...args),
          onPushPositionHover: (...args) =>
            clientRpc.onPushPositionHover(...args),
          onServerReject: (...args) => clientRpc.onServerReject(...args),
        })
      )
      const notifyObj = _.mapValues(clientRpcObj, (val, key) => {
        return clientRpc.notify[key as keyof typeof clientRpc.notify]
      }) as t.RpcProxy<t.ClientRpcAPI>
      const clientRpcObjWithNotify: t.RpcProxyWithNotify<t.ClientRpcAPI> = {
        ...clientRpcObj,
        notify: wrapWithErrorIgnoring(clientRpcLogger, notifyObj),
      }

      const serverRpc = await opts.onClientConnect(
        { disconnect: () => ws.close() },
        clientRpcObjWithNotify,
        meta
      )
      const server = new MoleServer({
        transports: [],
      })
      const rpcLogger = getLogger(`SERVER RPC (${meta.playerId}):`)
      server.expose(
        wrapWithLogging(rpcLogger, wrapWithErrorIgnoring(rpcLogger, serverRpc))
      )
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
