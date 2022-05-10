import * as t from 'src/gameTypes'
import { Logger } from 'src/utils/logger'

export const SERVER_TOWARDS_CLIENT_TIMEOUT_SECONDS = 10

/*
 * This is required to be lower than the server's timeout towards clients.
 * Think of this scenario:
 *  1. You send "kick player 2" to server (5s timeout)
 *  2. Server sends "server is full, get out" to player 2 (10s timeout)
 *  3. Player 2 disconnects without responding
 *  4. ... server keeps waiting
 *  5. Your client times out before server responds to you -> recycle of your client
 */
export const CLIENT_TOWARDS_SERVER_TIMEOUT_SECONDS =
  SERVER_TOWARDS_CLIENT_TIMEOUT_SECONDS - 3

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
  serverPeerId: string
  serverWebSocketPort: number
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
