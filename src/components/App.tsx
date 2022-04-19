import React from 'react'
import ClientGame from 'src/components/ClientGame'
import HostGame from 'src/components/HostGame'
import './App.css'

export const App = () => {
  const maybeServerId = window.location.hash.slice(1)
  const serverId = maybeServerId === '' ? undefined : maybeServerId

  if (serverId) {
    return <ClientGame serverPeerId={serverId} />
  }
  return <HostGame />
}

export default App
