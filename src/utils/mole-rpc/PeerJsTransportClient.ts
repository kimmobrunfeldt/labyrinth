import Peer from 'peerjs'

export type PeerJsTransportClientOptions = {
  peerConnection: Peer.DataConnection
}

export class PeerJsTransportClient {
  peerConnection: Peer.DataConnection
  closed: boolean

  constructor({ peerConnection }: PeerJsTransportClientOptions) {
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
    this.peerConnection.on('data', callback)
  }

  async sendData(data: unknown) {
    if (this.closed) {
      throw new Error('Peer connection closed')
    }

    return this.peerConnection.send(data)
  }
}
