import MoleClient from 'mole-rpc/MoleClientProxified'
import MoleServer from 'mole-rpc/MoleServer'
import Peer from 'peerjs'
import { PeerJsTransportClient } from 'src/core/TransportClient'
import { PeerJsTransportServer } from 'src/core/TransportServer'
import * as t from 'src/core/types'
import { wrapWithLogging } from 'src/core/utils'
import { iceServers } from 'src/peerConfig'

export type ClientProps = {
  onPeerError?: (err: Error) => void
  onPeerConnectionError?: (err: Error) => void
  onPeerConnectionClose?: () => void
}

export async function createClient(
  playerId: string,
  serverPeerId: string,
  {
    onStateChange,
    getMove,
    getPush,
    onPeerError,
    onPeerConnectionClose,
    onPeerConnectionError,
  }: t.PromisifyMethods<t.PlayerRpcAPI> & ClientProps
): Promise<t.PromisifyMethods<t.ServerRpcAPI>> {
  const peer = new Peer({
    // debug: 10,
    config: {
      iceServers,
    },
  })
  peer.on('error', (err) => {
    console.error(err)
    onPeerError && onPeerError(err)
  })

  return new Promise((resolve) => {
    peer.on('open', () => {
      const conn = peer.connect(serverPeerId, {
        metadata: {
          id: playerId,
        },
      })

      conn.on('open', async () => {
        const client = new MoleClient({
          requestTimeout: 2000,
          transport: new PeerJsTransportClient({
            peerConnection: conn,
          }),
        })

        // This client server listens for commands incoming from the server
        const clientServer = new MoleServer({
          transports: [new PeerJsTransportServer({ peerConnection: conn })],
        })

        const clientRpcApi: t.PromisifyMethods<t.PlayerRpcAPI> = {
          onStateChange,
          getPush,
          getMove,
        }

        clientServer.expose(wrapWithLogging('server', clientRpcApi))
        await clientServer.run()

        resolve(client)
      })

      conn.on('close', () => onPeerConnectionClose && onPeerConnectionClose())
      conn.on(
        'error',
        (err) => onPeerConnectionError && onPeerConnectionError(err)
      )
    })
  })
}
