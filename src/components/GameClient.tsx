import _ from 'lodash'
import React, { useEffect, useRef, useState } from 'react'
import BoardComponent from 'src/components/Board'
import ConfirmLeave from 'src/components/ConfirmLeave'
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
        flex: 1,
        flexDirection: 'column',
        justifyContent: 'space-between',
        alignItems: 'center',
        position: 'relative',
      }}
    >
      {children}
    </div>
  )
}

type Message = { time: Date; message: string }
function createMessage(msg: string): Message {
  return {
    time: new Date(),
    message: msg,
  }
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
  const [messages, setMessages] = useState<Message[]>([
    createMessage('Game setup'),
  ])
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
          onMessage(msg)
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

  function onMessage(msg: string) {
    setMessages((msgs) => [...msgs, createMessage(msg)])
  }

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
    return (
      <Container {...containerProps}>
        <div style={{ padding: '20px' }}>Error: {error.message}</div>
      </Container>
    )
  }

  if (!gameState) {
    const message = adminToken
      ? 'Starting the server ...'
      : `Connecting to ${serverPeerId} ...`
    return (
      <Container {...containerProps}>
        <div style={{ padding: '20px' }}>{message}</div>
      </Container>
    )
  }

  const myNextCard = gameState.myCurrentCards[0]
  return (
    <Container {...containerProps}>
      <ConfirmLeave
        when={
          Boolean(adminToken) &&
          gameState &&
          gameState.stage === 'playing' &&
          process.env.NODE_ENV !== 'development'
        }
      />

      <MenuBar
        gameState={gameState}
        showAdmin={!_.isUndefined(adminToken)}
        onAddBotClick={onAddBot}
        onStartGameClick={onStartGameClick}
        onRestartGameClick={onRestartGameClick}
        serverPeerId={serverPeerId}
      />

      <div
        style={{
          padding: '0 10px',
          position: 'relative',
          width: '100%',
          height: '100%',
        }}
      >
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
          <BoardShuffleIcon onShuffleBoardClick={onShuffleBoardClick} />
        )}
      </div>

      <div style={{ padding: '0 15px', width: '100%' }}>
        <MessageBox messages={messages} />
      </div>
    </Container>
  )
}

const BoardShuffleIcon = ({
  onShuffleBoardClick,
}: {
  onShuffleBoardClick: () => void
}) => (
  <div
    style={{
      userSelect: 'none',
      position: 'absolute',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      width: '100%',
      height: '100%',
      top: 0,
      left: 0,
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
)

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

const MessageBox = ({ messages }: { messages: Message[] }) => (
  <div
    style={{
      background: '#eee',
      width: '100%',
      padding: '20px 20px',
      fontSize: '12px',
      height: '150px',
      borderRadius: '5px',
      overflow: 'auto',
    }}
  >
    {messages.map((msg, i) => (
      <div
        key={i}
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          fontFamily: 'monospace',
        }}
      >
        <div style={{ marginRight: '10px' }}>
          {msg.time.toLocaleTimeString()}
        </div>
        <div>{msg.message}</div>
      </div>
    ))}
  </div>
)

export default GameClient
