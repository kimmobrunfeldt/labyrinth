import Peer from 'peerjs'

export type PeerJsTransportServerOptions = {
  peerConnection: Peer.DataConnection
}

export class PeerJsTransportServer {
  peerConnection: Peer.DataConnection

  constructor({ peerConnection }: PeerJsTransportServerOptions) {
    this.peerConnection = peerConnection
  }

  onData(callback: (data: unknown) => unknown) {
    this.peerConnection.on('data', async (reqData) => {
      const respData = await callback(reqData)
      if (!respData) return // no data means notification
      this.peerConnection.send(respData)
    })
  }
}
