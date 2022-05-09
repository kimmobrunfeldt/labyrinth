import { Socket } from 'net'
import split2 from 'split2'

export class TcpTransportServer {
  private readonly socket: Socket
  public closed: boolean

  constructor({ socket }: { socket: Socket }) {
    this.socket = socket
    this.closed = false

    socket.on('error', () => (this.closed = true))
    socket.on('close', () => (this.closed = true))
  }

  onData(callback: (data: string) => string) {
    this.socket.pipe(split2('\n')).on('data', async (reqData) => {
      const respData = await callback(reqData)
      if (!respData) return // no data means notification
      if (this.closed) {
        throw new Error('Socket closed')
      }

      this.socket.write(respData)
    })
  }
}
