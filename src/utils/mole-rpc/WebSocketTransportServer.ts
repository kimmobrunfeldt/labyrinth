import WebSocket from 'ws'

export class WebSocketTransportServer {
  private readonly ws: WebSocket.WebSocket
  public closed: boolean

  constructor({ ws }: { ws: WebSocket.WebSocket }) {
    this.ws = ws
    this.closed = false

    ws.addEventListener('error', () => (this.closed = true))
    ws.addEventListener('close', () => (this.closed = true))
  }

  public onData(callback: (data: string) => string) {
    this.ws.addEventListener('message', async (event) => {
      const respData = await callback(event.data.toString())
      if (!respData) return // no data means notification
      if (this.closed) {
        throw new Error('Websocket closed')
      }

      this.ws.send(respData)
    })
  }
}
