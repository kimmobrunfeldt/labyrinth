import _ from 'lodash'
import MoleClient from 'mole-rpc/MoleClientProxified'
import MoleServer from 'mole-rpc/MoleServer'
import X from 'mole-rpc/X'
import retryify from 'promise-retryify'
import { CLIENT_TOWARDS_SERVER_TIMEOUT_SECONDS } from 'src/core/server/networking/utils'
import * as t from 'src/gameTypes'
import {
  getLogger,
  getUniqueEmoji,
  Logger,
  prefixLogger,
} from 'src/utils/logger'
import { WebSocketTransportClient } from 'src/utils/mole-rpc/WebSocketTransportClient'
import { WebSocketTransportServer } from 'src/utils/mole-rpc/WebSocketTransportServer'
import { createRecycler, Recycler } from 'src/utils/recycler'
import { wrapWithLogging } from 'src/utils/utils'
import WebSocket from 'ws'

export type ClientOptions = {
  playerId: string
  playerName?: string
  wsUrl: string
  onWebSocketError?: (err: Error) => void
  onWebSocketClose?: () => void
  onWebSocketOpen?: () => void
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
            opts.rpcLogger ?? getLogger(`${getUniqueEmoji()} CLIENT RPC`), // eslint-disable-line no-irregular-whitespace
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
        newCurrent.ws.addEventListener('close', cb)
        newCurrent.ws.addEventListener('error', cb)
      },
    })

  return recycler.current
}

async function _createClient(
  opts: t.RequiredBy<ClientOptions, 'rpcLogger'>
): Promise<{
  serverRpc: t.RpcProxyWithNotify<t.ServerRpcAPI>
  destroy: () => void
  ws: WebSocket.WebSocket
}> {
  const ws = new WebSocket(opts.wsUrl)

  ws.addEventListener('open', () => {
    opts.onWebSocketOpen && opts.onWebSocketOpen()

    // Send initial metadata
    ws.send(
      JSON.stringify({ playerId: opts.playerId, playerName: opts.playerName })
    )
  })
  ws.addEventListener('close', () => {
    opts.onWebSocketClose && opts.onWebSocketClose()
  })
  ws.addEventListener('error', (e) => {
    opts.onWebSocketError && opts.onWebSocketError(e.error)
  })

  return {
    serverRpc: createRpc(ws, opts),
    destroy: () => {
      ws.close()
    },
    ws,
  }
}

function createRpc(
  ws: WebSocket.WebSocket,
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
  const incomingLogger = prefixLogger(opts.rpcLogger, '<-')
  clientServer.expose(wrapWithLogging(incomingLogger, clientRpc))
  clientServer.registerTransport(new WebSocketTransportServer({ ws }))

  const client: t.RpcProxyWithNotify<t.ServerRpcAPI> = new MoleClient({
    requestTimeout: CLIENT_TOWARDS_SERVER_TIMEOUT_SECONDS * 1000,
    transport: new WebSocketTransportClient({
      ws,
    }),
  })
  const outgoingLogger = prefixLogger(opts.rpcLogger, '->')
  // Re-create the proxified functions for retryify to work
  const clientObj: t.RpcProxy<t.ServerRpcAPI> = wrapWithLogging(
    outgoingLogger,
    {
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
  )

  const retryOptions: Parameters<typeof retryify>[1] = {
    // 3s, 6s
    retryTimeout: (retryCount) => (retryCount + 1) * 3000,
    maxRetries: 1,
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
        ws.close()
      }
    },
  }
  const retryClient = retryify(clientObj, retryOptions)
  const notifyObj = wrapWithLogging(
    outgoingLogger,
    _.mapValues(clientObj, (val, key) => {
      return client.notify[key as keyof typeof client.notify]
    })
  ) as t.RpcProxy<t.ServerRpcAPI>

  return {
    ...retryClient,
    notify: retryify(notifyObj, retryOptions),
  }
}
