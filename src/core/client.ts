import MoleClient from 'mole-rpc/MoleClientProxified'
import Peer from 'peerjs'
import { PublicGameLoopMethods } from 'src/core/gameLoop'
import { PeerJsTransportClient } from 'src/core/TransportClient'

export async function createClient(
  serverPeerId: string
): Promise<PublicGameLoopMethods> {
  const peer = new Peer({
    debug: 10,
  })
  peer.on('error', (err) => console.error(err))

  return new Promise((resolve) => {
    peer.on('open', () => {
      const conn = peer.connect(serverPeerId)

      conn.on('open', async () => {
        const client = new MoleClient({
          transport: new PeerJsTransportClient({
            peerConnection: conn,
          }),
        })

        resolve(client)
      })

      conn.on('close', () => console.log('conn close'))
      conn.on('error', (err) => console.error(err))
    })
  })
}
