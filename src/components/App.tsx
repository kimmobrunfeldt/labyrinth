import React, { useEffect, useState } from 'react'
import Debug from 'src/components/Debug'
import GameClient from 'src/components/GameClient'
import StartPage from 'src/components/StartPage'
import { BotId } from 'src/core/bots/availableBots'
import { connectBot } from 'src/core/bots/framework'
import { Client } from 'src/core/client/peerjsClient'
import { createServer } from 'src/core/server/server'
import { getKey, saveKey } from 'src/utils/sessionStorage'
import { getRandomPeerId, uuid } from 'src/utils/utils'
import './App.css'

export const App = () => {
  const [client, setClient] = useState<Pick<Client, 'serverRpc'> | undefined>(
    undefined
  )
  const [server, setServer] = useState<
    | {
        peerId: string
        adminToken?: string
        isServerHost: boolean
        wsUrl?: string
      }
    | undefined
  >(undefined)

  const params = new URLSearchParams(window.location.search)

  useEffect(() => {
    async function init() {
      const wsUrl = params.get('ws') ?? undefined
      const botsStr = params.get('bots') ?? ''
      const bots = botsStr
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 1)

      if (bots.length > 0) {
        const s = await hostGame()

        for (const id of bots) {
          await connectBot(id as BotId, `bot-${uuid()}`, s.peerId, wsUrl)
        }

        return
      }

      if (wsUrl) {
        setServer({
          peerId: wsUrl, // Hack to show websocket url at the top of the UI
          adminToken: params.get('adminToken') ?? undefined,
          isServerHost: false,
          wsUrl,
        })
        return
      }

      const maybeServerId = window.location.hash.slice(1)
      const serverPeerId = maybeServerId === '' ? undefined : maybeServerId

      if (serverPeerId) {
        joinPeerJsGame(serverPeerId)
      }
    }

    init().catch((err) => console.error('Error during init:', err))
  }, [])

  async function hostGame() {
    // Make server id stable across page closes
    let serverPeerId = getKey('serverPeerId')
    if (!serverPeerId) {
      serverPeerId = getRandomPeerId()
      saveKey('serverPeerId', serverPeerId)
    }

    const server = await createServer({
      serverPeerId,
      serverWebSocketPort: -1, // not used in browser
      cardsPerPlayer: 5,
    })
    setServer({ ...server, isServerHost: true })
    return server
  }

  function joinPeerJsGame(serverPeerId: string) {
    setServer({
      peerId: serverPeerId,
      adminToken: undefined,
      isServerHost: false,
    })
    window.location.hash = serverPeerId
  }

  if (params.get('debug') === 'true') {
    return <Debug />
  }

  return (
    <div className="App">
      {!server && (
        <StartPage onHostGame={hostGame} onJoinGame={joinPeerJsGame} />
      )}

      {server && (
        <GameClient
          serverPeerId={server.peerId}
          adminToken={server.adminToken}
          spectate={params.get('spectate') === 'true'}
          onClientCreated={setClient}
          wsUrl={server.wsUrl}
        />
      )}
    </div>
  )
}

export default App
