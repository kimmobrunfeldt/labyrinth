import MoleClient from 'mole-rpc/MoleClientProxified'
import MoleServer from 'mole-rpc/MoleServer'
import Peer from 'peerjs'
import { PeerJsTransportClient } from 'src/core/TransportClient'
import { PeerJsTransportServer } from 'src/core/TransportServer'
import * as t from 'src/core/types'
import { wrapWithLogging } from 'src/core/utils'
import { iceServers } from 'src/peerConfig'

export type ClientOptions = {
  playerId: string
  serverPeerId: string
  onClientCreated?: (client: t.PromisifyMethods<t.ServerRpcAPI>) => void
  onPeerError?: (err: Error) => void
  onPeerConnectionError?: (err: Error) => void
  onPeerConnectionClose?: () => void
  onPeerConnectionOpen?: () => void
  onStateChange: t.PromisifyMethods<t.PlayerRpcAPI>['onStateChange']
  getPush: t.PromisifyMethods<t.PlayerRpcAPI>['getPush']
  getMove: t.PromisifyMethods<t.PlayerRpcAPI>['getMove']
}

export function createClient(opts: ClientOptions) {
  createPeer(opts)
  /*
  let connectionOpen = false

  const recreateClient = () => {
    if (!connectionOpen) {
      createClient(opts)

      setTimeout(() => {
        recreateClient()
      }, 5000)
    }
  }

  const { onPeerConnectionClose, onPeerConnectionOpen, ...rest } = opts
  const newOnPeerConnectionClose = () => {
    connectionOpen = false
    onPeerConnectionClose && onPeerConnectionClose()
    recreateClient()
  }
  const newOnPeerConnectionOpen = () => {
    connectionOpen = true
    onPeerConnectionOpen && onPeerConnectionOpen()
  }

  createPeer({
    ...rest,
    onPeerConnectionClose: newOnPeerConnectionClose,
    onPeerConnectionOpen: newOnPeerConnectionOpen,
  })
  */
}

function createPeer(opts: ClientOptions) {
  const peer = new Peer({
    debug: 10,
    config: {
      iceServers,
    },
  })
  peer.on('error', (err) => {
    console.log('On PEER error')
    console.error(err)
    opts.onPeerError && opts.onPeerError(err)
  })

  peer.on('open', () => {
    createConnection(peer, opts)
  })

  return peer
}

function createConnection(peer: Peer, opts: ClientOptions) {
  const conn = peer.connect(opts.serverPeerId, {
    reliable: true,
    metadata: {
      id: opts.playerId,
    },
  })

  conn.on('open', async () => {
    opts.onPeerConnectionOpen && opts.onPeerConnectionOpen()

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
      onStateChange: opts.onStateChange,
      getPush: opts.getPush,
      getMove: opts.getMove,
    }

    clientServer.expose(wrapWithLogging('server', clientRpcApi))
    await clientServer.run()
    opts.onClientCreated && opts.onClientCreated(client)
  })

  conn.on('close', () => {
    console.log('On CONNECTION close')
    opts.onPeerConnectionClose && opts.onPeerConnectionClose()
  })
  conn.on('error', (err) => {
    console.log('On CONNECTION error')
    opts.onPeerConnectionError && opts.onPeerConnectionError(err)
  })
  return conn
}
