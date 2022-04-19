import MoleServer from 'mole-rpc/MoleServer'
import Peer from 'peerjs'
import { CreateGameOptions } from 'src/core/game'
import { createGameLoop } from 'src/core/gameLoop'
import { PeerJsTransportServer } from 'src/core/TransportServer'
import { getRandomPeerId } from 'src/core/utils'

export async function createServer(
  gameOpts: CreateGameOptions = {}
): Promise<{ peerId: string }> {
  const gameLoop = await createGameLoop(gameOpts)
  const server = new MoleServer({
    transports: [],
  })
  server.expose(gameLoop.publicMethods)

  const peerId = getRandomPeerId()
  const peer = new Peer('mouse-ghost-779', {
    debug: 10,
  })
  peer.on('error', (err) => console.error(err))

  return new Promise((resolve) => {
    peer.on('open', (openPeerId) => {
      peer.on('connection', (conn) => {
        conn.on('open', async () => {
          server.registerTransport(
            new PeerJsTransportServer({
              peerConnection: conn,
            })
          )
        })

        conn.on('close', () => {
          // XXX: Memory-leak sensitive
          console.log('Client closed connection')
        })
      })

      resolve({ peerId: openPeerId })
    })
  })
}
