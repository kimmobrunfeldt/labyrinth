/**
 * Left as a reference.
 */

import MoleClient from 'mole-rpc/MoleClientProxified'
import MoleServer from 'mole-rpc/MoleServer'
import { createServer, Server } from 'net'
import split2 from 'split2'
import {
  ConnectionMetadata,
  CreateServerNetworkingOptions,
  SERVER_TOWARDS_CLIENT_TIMEOUT_SECONDS,
} from 'src/core/server/networking/utils'
import * as t from 'src/gameTypes'
import { getLogger } from 'src/utils/logger'
import { TcpTransportClient } from 'src/utils/mole-rpc/TcpTransportClient'
import { TcpTransportServer } from 'src/utils/mole-rpc/TcpTransportServer'
import { createRecycler } from 'src/utils/recycler'
import { wrapWithLogging } from 'src/utils/utils'

export async function createServerTcpNetworking(
  opts: CreateServerNetworkingOptions
) {
  const recycler = await createRecycler({
    logger: opts.logger,
    factory: async () => await _createServerTcpNetworking(opts),
    destroyer: async (current) => current.destroy(),
    autoRecycle: (newCurrent, cb) => {
      newCurrent.server.on('error', cb)
    },
  })

  return recycler.current
}

async function _createServerTcpNetworking(
  opts: CreateServerNetworkingOptions
): Promise<{
  destroy: () => void
  server: Server
}> {
  const server = createServer()
  server.listen({ port: 8009 })

  /**
   * After connection has been established, client should send metadata as a JSON,
   * followed by a newline. After this initial exchange, all communication happens
   * as JSON RPC.
   */
  server.on('connection', async (socket) => {
    socket.on('error', () => socket.destroy())

    const timer = setTimeout(() => {
      socket.write('Initial metadata not received, closing connection.')
      socket.destroy()
    }, 5000)
    socket.pipe(split2('\n')).once('data', (metadata) => {
      clearTimeout(timer)
      onConnectionOpen(metadata)
    })

    async function onConnectionOpen(meta: ConnectionMetadata) {
      const clientRpc: t.RpcProxyWithNotify<t.ClientRpcAPI> = new MoleClient({
        requestTimeout: SERVER_TOWARDS_CLIENT_TIMEOUT_SECONDS * 1000,
        transport: new TcpTransportClient({
          socket,
        }),
      })

      const serverRpc = await opts.onClientConnect(
        { disconnect: () => socket.destroy() },
        clientRpc,
        meta
      )
      const server = new MoleServer({
        transports: [],
      })
      const rpcLogger = getLogger(`SERVER RPC (${meta.playerId}):`)
      server.expose(wrapWithLogging(rpcLogger, serverRpc))
      server.registerTransport(
        new TcpTransportServer({
          socket,
        })
      )
    }
  })

  return {
    destroy: () => server.close(),
    server,
  }
}
