import React, { useEffect, useState } from 'react'
import GameClient from 'src/components/GameClient'
import StartPage from 'src/components/StartPage'
import { createServer } from 'src/core/server'
import { getKey, saveKey } from 'src/sessionStorage'
import { getRandomPeerId } from 'src/utils/utils'
import './App.css'

export const App = () => {
  const [server, setServer] = useState<
    { peerId: string; adminToken?: string; isServerHost: boolean } | undefined
  >(undefined)

  useEffect(() => {
    const maybeServerId = window.location.hash.slice(1)
    const serverPeerId = maybeServerId === '' ? undefined : maybeServerId

    if (serverPeerId) {
      joinGame(serverPeerId)
    }
  }, [setServer])

  async function hostGame() {
    // Make server id stable across page closes
    let serverPeerId = getKey('serverPeerId')
    if (!serverPeerId) {
      serverPeerId = getRandomPeerId()
      saveKey('serverPeerId', serverPeerId)
    }

    const server = await createServer({
      peerId: serverPeerId,
      cardsPerPlayer: 1,
    })
    setServer({ ...server, isServerHost: true })

    // await createBot(`bot-${getRandomAdminToken()}`, server)
  }

  function joinGame(serverPeerId: string) {
    setServer({
      peerId: serverPeerId,
      adminToken: undefined,
      isServerHost: false,
    })
    window.location.hash = serverPeerId
  }

  return (
    <div className="App">
      {!server && <StartPage onHostGame={hostGame} onJoinGame={joinGame} />}

      {server && (
        <GameClient
          serverPeerId={server.peerId}
          adminToken={server.adminToken}
        />
      )}
    </div>
  )
}

export default App
