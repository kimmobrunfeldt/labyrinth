import _ from 'lodash'
import React, { useEffect, useRef, useState } from 'react'
import BoardComponent from 'src/components/Board'
import MenuBar from 'src/components/MenuBar'
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
import { uuid } from 'src/utils/utils'
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
        serverPeerId={serverPeerId}
      />

      <Container {...containerProps}>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            position: 'absolute',
            top: '10px',
            right: '0',
            textAlign: 'center',
          }}
        >
          <div style={{ fontWeight: 'bold', color: '#555' }}>NEXT</div>
          <img
            style={{
              position: 'relative',
              top: '-8px',
              width: '70px',
            }}
            src={`${process.env.PUBLIC_URL}/pieces/${myNextCard.trophy}.svg`}
            alt={myNextCard.trophy}
          />
        </div>
        {gameState && (
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
        )}
      </Container>
    </div>
  )
}

export default GameClient
