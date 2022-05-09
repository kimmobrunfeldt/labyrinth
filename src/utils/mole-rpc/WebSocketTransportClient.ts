import WebSocket from 'ws'

export class WebSocketTransportClient {
  private readonly ws: WebSocket.WebSocket
  public closed: boolean

  constructor({ ws }: { ws: WebSocket.WebSocket }) {
    this.ws = ws
    this.closed = false

    ws.addEventListener('error', () => (this.closed = true))
    ws.addEventListener('close', () => (this.closed = true))
  }

  public onData(callback: (data: string) => void): void {
    this.ws.addEventListener('message', (event) =>
      callback(event.data.toString())
    )
  }

  public async sendData(data: string): Promise<void> {
    if (this.closed) {
      throw new Error('Websocket closed')
    }

    this.ws.send(data)
  }
}
