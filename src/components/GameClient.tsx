import _ from 'lodash'
import React, { useEffect, useRef, useState } from 'react'
import BoardComponent from 'src/components/Board'
import MenuBar from 'src/components/MenuBar'
import { RotateIcon } from 'src/components/RotateIcon'
import { getNewRotation } from 'src/core/board'
import { connectBot } from 'src/core/bots/random'
import { createClient } from 'src/core/client'
import * as t from 'src/gameTypes'
import { ClientGameState, Position } from 'src/gameTypes'
import { getKey, saveKey } from 'src/sessionStorage'
import {
  boardPushPositionToUIPosition,
  UIPushPosition,
  uiPushPositionToBoard,
} from 'src/utils/uiUtils'
import { getLogger, uuid } from 'src/utils/utils'
import './App.css'

type Props = {
  serverPeerId: string
  adminToken?: string
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
        position: 'relative',
        padding: '30px 15px',
      }}
    >
      {children}
    </div>
  )
}

export const GameClient = (props: Props) => {
  const { serverPeerId, adminToken } = props

  const [error, setError] = useState<Error | undefined>(undefined)
  const [client, setClient] = useState<
    Awaited<ReturnType<typeof createClient>> | undefined
  >(undefined)
  const [gameState, setGameState] = useState<ClientGameState | undefined>(
    undefined
  )
  const [pushPositionHover, setPushPositionHover] = useState<
    UIPushPosition | undefined
  >(undefined)
  const [messages, setMessages] = useState<string[]>([])
  const bots = useRef<Array<Awaited<ReturnType<typeof createClient>>>>([])

  useEffect(() => {
    async function init() {
      // Make player id stable across page closes
      let playerId = getKey('playerId')
      if (!playerId) {
        playerId = uuid()
        saveKey('playerId', playerId)
      }

      const client = await createClient({
        playerId,
        logger: getLogger(`CLIENT:`),
        serverPeerId,
        onPeerError: (err) => {
          setError(err)
        },
        onPeerConnectionClose: () => {
          setError(new Error('Game server disconnected'))
        },
        onPeerConnectionOpen: () => {
          setError(undefined)
        },
        onPeerConnectionError: (err) => {
          setError(err)
        },
        onStateChange: async (state) => {
          setError(undefined)
          setGameState(state)
        },
        onPushPositionHover: async (boardPos?: Position) => {
          const uiPos = boardPos
            ? boardPushPositionToUIPosition(boardPos)
            : undefined
          setPushPositionHover(uiPos)
        },
        onServerFull: async () => {
          setError(new Error('Game server full'))
        },
        onMessage: async (msg) => {
          console.log('msg', msg)
          setMessages([...messages, msg])
        },
      })
      if (adminToken) {
        await client.client.promote(adminToken)
      }

      setGameState(await client.client.getState())
      setClient(client)
    }
    init()
  }, [])

  function isMyTurn() {
    if (!gameState) {
      return false
    }

    const myIndex = _.findIndex(
      gameState.players,
      (p) => p.id === gameState.me.id
    )
    return gameState.playerTurn === myIndex
  }

  async function onAddBot() {
    const client = await connectBot(`bot-${uuid()}`, { peerId: serverPeerId })
    bots.current.push(client)
  }

  async function onMove(piece: t.CensoredPieceOnBoard) {
    if (!client || !gameState || !isMyTurn()) {
      return
    }

    await client.client.move(piece.position)
  }

  async function onPush(pushPos: t.PushPosition) {
    if (!client || !gameState || !isMyTurn()) {
      return
    }

    await client.client.push(pushPos)
  }

  function onClickExtraPiece() {
    if (!client || !gameState || gameState.playerHasPushed) {
      return
    }

    client.client.setExtraPieceRotation(
      getNewRotation(gameState.pieceBag[0].rotation, 90)
    )
  }

  async function onPushPositionHover(hoverPos?: UIPushPosition) {
    if (!client || !gameState) {
      return
    }

    if (
      !isMyTurn() ||
      gameState.playerHasPushed ||
      gameState.stage !== 'playing'
    ) {
      return
    }

    const boardPos = hoverPos ? uiPushPositionToBoard(hoverPos) : undefined
    // Don't wait for finish
    void client.client.setPushPositionHover(boardPos)
  }

  async function onStartGameClick() {
    if (!client || !adminToken) {
      return
    }
    await client.client.start(adminToken)
  }

  async function onRestartGameClick() {
    if (!client || !adminToken || !gameState) {
      return
    }

    if (
      gameState.stage === 'playing' &&
      process.env.NODE_ENV !== 'development'
    ) {
      const userConfirmed = window.confirm('Restart game?')
      if (!userConfirmed) {
        return
      }
    }

    await client.client.restart(adminToken)
  }

  async function onShuffleBoardClick() {
    if (!client || !adminToken) {
      return
    }
    await client.client.shuffleBoard(adminToken, 'hard')
  }

  const containerProps = {
    ...props,
    gameState,
  }

  if (error) {
    return <Container {...containerProps}>Error: {error.message}</Container>
  }

  if (!gameState) {
    const message = adminToken
      ? 'Starting the server ...'
      : `Connecting to ${serverPeerId} ...`
    return <Container {...containerProps}>{message}</Container>
  }

  const myNextCard = gameState.myCurrentCards[0]
  return (
    <div>
      <MenuBar
        gameState={gameState}
        showAdmin={!_.isUndefined(adminToken)}
        onAddBotClick={onAddBot}
        onStartGameClick={onStartGameClick}
        onRestartGameClick={onRestartGameClick}
        serverPeerId={serverPeerId}
      />

      <Container {...containerProps}>
        {gameState.stage !== 'setup' && myNextCard && (
          <CurrentTrophy trophy={myNextCard.trophy} />
        )}
        <BoardComponent
          gameState={gameState}
          extraPiece={gameState.pieceBag[0]}
          players={gameState.players}
          board={gameState.board}
          onMove={onMove}
          onPush={onPush}
          onClickExtraPiece={onClickExtraPiece}
          previousPushPosition={gameState.previousPushPosition}
          pushPositionHover={pushPositionHover}
          onPushPositionHover={onPushPositionHover}
          isMyTurn={isMyTurn()}
          playerHasPushed={gameState.playerHasPushed}
          playerInTurn={gameState.players[gameState.playerTurn]}
        />

        {gameState.stage === 'setup' && (
          <div
            style={{
              userSelect: 'none',
              position: 'absolute',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              width: '100%',
              height: '100%',
            }}
          >
            <div
              title="Shuffle board"
              onClick={onShuffleBoardClick}
              className="icon-hover"
              style={{
                cursor: 'pointer',
                position: 'absolute',
                zIndex: 10,
                width: '10%',
                maxWidth: '60px',
              }}
            >
              <RotateIcon
                fill="#454545"
                style={{
                  width: '100%',
                }}
              />
            </div>
          </div>
        )}
      </Container>
    </div>
  )
}

const CurrentTrophy = ({ trophy }: { trophy: t.Trophy }) => (
  <div
    style={{
      display: 'flex',
      flexDirection: 'column',
      position: 'absolute',
      top: '8px',
      right: '0',
      textAlign: 'center',
    }}
  >
    <div style={{ fontWeight: 'bold', color: '#555' }}>NEXT</div>
    <img
      style={{
        position: 'relative',
        top: '-15px',
        width: '70px',
      }}
      src={`${process.env.PUBLIC_URL}/pieces/${trophy}.svg`}
      alt={trophy}
    />
  </div>
)

export default GameClient
