import React, { useEffect, useState } from 'react'
import GameClient from 'src/components/GameClient'
import { createBot } from 'src/core/bots/random'
import { createServer } from 'src/core/server'
import { getRandomAdminToken } from 'src/core/utils'
import './App.css'

export const App = () => {
  const [server, setServer] = useState<
    { peerId: string; adminToken?: string } | undefined
  >(undefined)

  useEffect(() => {
    async function init() {
      const maybeServerId = window.location.hash.slice(1)
      const serverPeerId = maybeServerId === '' ? undefined : maybeServerId

      if (!serverPeerId) {
        // Launch server
        const server = await createServer({ cardsPerPlayer: 2 })
        setServer(server)

        await createBot(`bot-${getRandomAdminToken()}`, server)
      } else {
        setServer({
          peerId: serverPeerId,
          adminToken: undefined,
        })
      }
    }
    init()
  }, [])

  return (
    <div className="App">
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
