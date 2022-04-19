import Peer from 'peerjs'

function startServer(serverPeerId?: string) {
  const peer = new Peer()

  peer.on('connection', (conn) => {
    conn.on('data', (data) => {
      // Will print 'hi!'
      console.log(data)
    })
    conn.on('open', () => {
      conn.send('hello!')
    })
  })
}

function connectClient(serverPeerId: string) {
  const peer = new Peer()
  const conn = peer.connect(serverPeerId)
  conn.on('open', () => {
    conn.send('hi!')
  })

  conn.on('data', (data) => {})
}
