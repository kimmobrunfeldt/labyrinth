import Peer from 'peerjs'

export type PeerJsTransportServerOptions = {
  peerConnection: Peer.DataConnection
}

export class PeerJsTransportServer {
  peerConnection: Peer.DataConnection
  closed: boolean

  constructor({ peerConnection }: PeerJsTransportServerOptions) {
    this.peerConnection = peerConnection
    this.closed = false

    this.peerConnection.on('error', () => {
      this.closed = true
    })
    this.peerConnection.on('close', () => {
      this.closed = true
    })
  }

  onData(callback: (data: unknown) => unknown) {
    this.peerConnection.on('data', async (reqData) => {
      const respData = await callback(reqData)
      if (!respData) return // no data means notification
      if (this.closed) {
        throw new Error('Peer connection closed')
      }

      this.peerConnection.send(respData)
    })
  }
}
