import { useEffect } from 'react'
import { createServer } from 'src/core/server'
import './App.css'

type Props = {
  setServer: (server: Awaited<ReturnType<typeof createServer>>) => void
}

export const GameServer = ({ setServer }: Props) => {
  useEffect(() => {
    async function init() {
      // Launch server
      const server = await createServer()
      setServer(server)
    }
    init()
  }, [])

  return null
}

export default GameServer
