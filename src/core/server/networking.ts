import Peer from 'peerjs'
import { debugLevel, iceServers } from 'src/peerConfig'
import { createRecycler } from 'src/utils/recycler'
import { Logger, waitForEvent } from 'src/utils/utils'

export type CreateServerNetworkingOptions = {
  logger: Logger
  peerId?: string
  onClientConnect: (
    id: string,
    connection: Peer.DataConnection,
    name?: string
  ) => void
  onClientDisconnect: (id: string, connection: Peer.DataConnection) => void
}

export async function createServerNetworking(
  opts: CreateServerNetworkingOptions
) {
  const recycler = await createRecycler({
    logger: opts.logger,
    factory: async () => await _createServerNetworking(opts),
    destroyer: async (current) => current.destroy(),
    autoRecycle: (newCurrent, cb) => {
      newCurrent.peer.on('disconnected', cb)
      newCurrent.peer.on('error', cb)
    },
  })

  return recycler.current
}

async function _createServerNetworking(
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
