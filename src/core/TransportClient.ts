import Peer from 'peerjs'

export type PeerJsTransportClientOptions = {
  peerConnection: Peer.DataConnection
}

export class PeerJsTransportClient {
  peerConnection: Peer.DataConnection

  constructor({ peerConnection }: PeerJsTransportClientOptions) {
    this.peerConnection = peerConnection
  }

  onData(callback: (data: unknown) => unknown) {
    this.peerConnection.on('data', callback)
  }

  async sendData(data: unknown) {
    return this.peerConnection.send(data)
  }
}
