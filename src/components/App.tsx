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
    { peerId: string; adminToken?: string; isServerHost: boolean } | undefined
  >(undefined)

  useEffect(() => {
    const maybeServerId = window.location.hash.slice(1)
    const serverPeerId = maybeServerId === '' ? undefined : maybeServerId

    if (serverPeerId) {
      joinGame(serverPeerId)
    }
  }, [])

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

  const wsUrl = params.get('ws')
  if (wsUrl) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useEffect(() => {
      joinGame(wsUrl, params.get('adminToken') ?? undefined) // just a hack to show the url in the UI while connecting
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
      serverPeerId,
      serverWebSocketPort: -1, // not used in browser
      cardsPerPlayer: 5,
    })
    setServer({ ...server, isServerHost: true })
    return server
  }

  function joinGame(serverPeerId: string, adminToken?: string) {
    setServer({
      peerId: serverPeerId,
      adminToken,
      isServerHost: false,
    })
    window.location.hash = serverPeerId
  }

  if (params.get('debug') === 'true') {
    return <Debug />
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
