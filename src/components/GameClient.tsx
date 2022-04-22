import _ from 'lodash'
import React, { useEffect, useRef, useState } from 'react'
import AdminPanel from 'src/components/AdminPanel'
import BoardComponent from 'src/components/Board'
import PieceComponent from 'src/components/Piece'
import { getNewRotation, getPushPosition } from 'src/core/board'
import { createClient } from 'src/core/client'
import { getKey, saveKey } from 'src/core/sessionStorage'
import * as t from 'src/core/types'
import { ClientGameState, Position } from 'src/core/types'
import { EventEmitter, uuid } from 'src/core/utils'
import './App.css'

type Props = {
  serverPeerId: string
  adminToken?: string
}
export const GameClient = ({ serverPeerId, adminToken }: Props) => {
  const [error, setError] = useState<Error | undefined>(undefined)
  const [client, setClient] = useState<
    t.PromisifyMethods<t.ServerRpcAPI> | undefined
  >(undefined)
  const [gameState, setGameState] = useState<ClientGameState | undefined>(
    undefined
  )
  const emitter = useRef(new EventEmitter())

  useEffect(() => {
    async function init() {
      // Make player id stable across page closes
      let playerId = getKey('playerId')
      if (!playerId) {
        playerId = uuid()
        saveKey('playerId', playerId)
      }

      const client = await createClient(playerId, serverPeerId, {
        onPeerError: (err) => {
          setError(err)
        },
        onPeerConnectionClose: () => {
          setError(new Error('Game server disconnected'))
        },
        onPeerConnectionError: (err) => {
          setError(err)
        },
        onStateChange: async (state) => setGameState(state),
        getMove: async () => {
          const pos = await new Promise((resolve) => {
            emitter.current.addEventListener(
              'onClickPiece',
              _.once((e) => {
                resolve(e.piece.position)
              })
            )
          })

          return pos as Position
        },
        getPush: async () => {
          const pos = await new Promise((resolve) => {
            emitter.current.addEventListener(
              'onClickPiece',
              _.once((e) => {
                resolve(e.piece.position)
              })
            )
          })

          return getPushPosition(pos as Position)
        },
      })
      setGameState(await client.getState())
      setClient(client)
    }
    init()
  }, [])

  function onClickPiece(piece: t.CensoredPieceOnBoard) {
    // todo: update react ui
    emitter.current.dispatch('onClickPiece', { piece })
  }

  function onClickExtraPiece() {
    // todo: update react ui
    if (!client || !gameState) {
      return
    }
    client.setExtraPieceRotation(
      getNewRotation(gameState.pieceBag[0].rotation, 90)
    )
  }

  async function onStartGameClick() {
    // todo: update react ui
    if (!client || !adminToken) {
      return
    }
    await client.start(adminToken)
  }

  function Container({ children }: { children: React.ReactNode }) {
    return (
      <div
        className="GameClient"
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          paddingTop: '5vh',
        }}
      >
        {children}
      </div>
    )
  }

  if (error) {
    return <Container>Error: {error.message}</Container>
  }

  if (!gameState) {
    const message = adminToken
      ? 'Starting the server ...'
      : `Connecting to ${serverPeerId} ...`
    return <Container>{message}</Container>
  }

  return (
    <Container>
      {adminToken && <AdminPanel onStartGameClick={onStartGameClick} />}
      {gameState && (
        <BoardComponent
          players={gameState.players}
          board={gameState.board}
          onClickPiece={onClickPiece}
        />
      )}
      {gameState && (
        <div style={{ position: 'relative' }}>
          <PieceComponent
            onClick={onClickExtraPiece}
            style={{}}
            piece={gameState.pieceBag[0]}
          />
        </div>
      )}
      {gameState && (
        <div>
          {gameState.players.map((player) => {
            const foundCount = player.censoredCards.filter(
              (c) => c.found
            ).length

            return (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                }}
                key={player.id}
              >
                <div style={{ width: '10px' }}>
                  {gameState.players[gameState.playerTurn].id === player.id
                    ? 'x'
                    : ''}
                </div>
                <div
                  style={{
                    height: '16px',
                    width: '16px',
                    margin: '5px',
                    background: player.color,
                    borderRadius: '9999px',
                  }}
                />
                <span>
                  <b>{player.name}</b> {foundCount} /{' '}
                  {player.censoredCards.length}
                  {player.id === gameState.me.id ? ' (me)' : ''}:
                </span>
                <span style={{ marginLeft: '5px' }}>
                  {player.currentCards.map((c) => c.trophy).join(', ')}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </Container>
  )
}

export default GameClient
