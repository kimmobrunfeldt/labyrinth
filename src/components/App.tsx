import React, { useEffect, useState } from 'react'
import GameClient from 'src/components/GameClient'
import StartPage from 'src/components/StartPage'
import { BotId } from 'src/core/bots/availableBots'
import { connectBot } from 'src/core/bots/framework'
import { Client } from 'src/core/client'
import { createServer } from 'src/core/server/server'
import { getKey, saveKey } from 'src/utils/sessionStorage'
import { getRandomPeerId, uuid } from 'src/utils/utils'
import './App.css'

export const App = () => {
  const [client, setClient] = useState<Client | undefined>(undefined)
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

  // Special parameters to make bot development easier

  const params = new URLSearchParams(window.location.search)
  const botsStr = params.get('bots') ?? ''
  const bots = botsStr
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 1)

  if (bots.length > 0) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useEffect(() => {
      async function init() {
        const s = await hostGame()
        for (const id of bots) {
          await connectBot(id as BotId, `bot-${uuid()}`, s.peerId)
        }
      }
      init()
    }, [])
  }

  if (params.get('spectate') === 'true') {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useEffect(() => {
      if (!client || !server) {
        return
      }
      client.serverRpc.spectate(server.adminToken!)
    })
  }

  async function hostGame() {
    // Make server id stable across page closes
    let serverPeerId = getKey('serverPeerId')
    if (!serverPeerId) {
      serverPeerId = getRandomPeerId()
      saveKey('serverPeerId', serverPeerId)
    }

    const server = await createServer({
      peerId: serverPeerId,
      cardsPerPlayer: 5,
    })
    setServer({ ...server, isServerHost: true })
    return server
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
          onClientCreated={setClient}
        />
      )}
    </div>
  )
}

export default App
