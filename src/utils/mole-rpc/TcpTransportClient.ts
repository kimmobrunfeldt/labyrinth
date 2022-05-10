import { Socket } from 'net'
import split2 from 'split2'

export class TcpTransportClient {
  private readonly socket: Socket
  public closed: boolean

  constructor({ socket }: { socket: Socket }) {
    this.socket = socket
    this.closed = false

    socket.on('error', () => (this.closed = true))
    socket.on('close', () => (this.closed = true))
  }

  public onData(callback: (data: string) => void): void {
    this.socket.pipe(split2('\n')).on('data', (line: string) => callback(line))
  }

  public async sendData(data: string): Promise<void> {
    if (this.closed) {
      throw new Error('Socket closed')
    }

    this.socket.write(`${data}\n`)
  }
}
