import _ from 'lodash'
import React, { useEffect, useState } from 'react'
import BoardComponent from 'src/components/Board'
import ConfirmLeave from 'src/components/ConfirmLeave'
import { RotateIcon } from 'src/components/Icons'
import MenuBar from 'src/components/MenuBar'
import { createMessage, Message, MessageBox } from 'src/components/MessagesBox'
import { NextTrophy } from 'src/components/NextTrophy'
import { VisibilityToggle } from 'src/components/VisibilityToggle'
import { BotId } from 'src/core/bots/availableBots'
import { connectBot } from 'src/core/bots/framework'
import { createClient } from 'src/core/client'
import { getNewRotation } from 'src/core/server/board'
import * as t from 'src/gameTypes'
import { ClientGameState } from 'src/gameTypes'
import * as localStorage from 'src/utils/localStorage'
import { getLogger, getUniqueEmoji } from 'src/utils/logger'
import { getKey, saveKey } from 'src/utils/sessionStorage'
import {
  boardPushPositionToUIPosition,
  UIPushPosition,
  uiPushPositionToBoard,
} from 'src/utils/uiUtils'
import { uuid } from 'src/utils/utils'
import { zIndices } from 'src/zIndices'

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
        alignItems: 'center',
        position: 'relative',
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
  const [lastServerHover, setLastServerHover] = useState<
    UIPushPosition | undefined
  >(undefined)
  const [messages, setMessages] = useState<Message[]>(
    adminToken
      ? [createMessage('You are the host. Game server runs on your browser.')]
      : []
  )
  const [playerLabelsVisible, setPlayerLabelsVisible] = useState(
    localStorage.getKey('playerLabelsHidden') !== 'true'
  )

  useEffect(() => {
    async function init() {
      // Make player id stable across page closes
      let playerId = getKey('playerId')
      if (!playerId) {
        playerId = uuid()
        saveKey('playerId', playerId)
      }

      const logEmoji = getUniqueEmoji()
      const client = await createClient({
        playerId,
        logger: getLogger(`${logEmoji} CLIENT:`), // eslint-disable-line no-irregular-whitespace
        rpcLogger: getLogger(`${logEmoji} CLIENT RPC:`), // eslint-disable-line no-irregular-whitespace
        serverPeerId,
        onJoin: async (state) => {
          setGameState(state)

          if (adminToken) {
            await client.serverRpc.promote(adminToken)
          }
        },
        onPeerError: (err) => {
          setError(err)
        },
        onPeerConnectionClose: () => {
          // setError(new Error('Game server disconnected'))
        },
        onPeerConnectionOpen: () => {
          setError(undefined)
        },
        onPeerConnectionError: (err) => {
          console.error(err)
          setError(err)
        },
        onStateChange: async (state) => {
          setError(undefined)
          setGameState(state)
        },
        onPushPositionHover: async (boardPos) => {
          const uiPos = boardPos
            ? boardPushPositionToUIPosition(boardPos)
            : undefined
          setLastServerHover(uiPos)
        },
        onServerReject: async (message) => {
          console.error('Rejected by server', message)
          setError(new Error(message))
        },
        onMessage: async (msg, opts) => {
          onMessage(msg, opts)
        },
      })

      setClient(client)
    }
    init()
    // We don't want to run this again pretty much ever
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function onMessage(msg: string, opts?: t.MessageFormatOptions) {
    setMessages((msgs) => [...msgs, createMessage(msg, opts)])
  }

  useEffect(() => {
    localStorage.saveKey(
      'playerLabelsHidden',
      playerLabelsVisible ? 'false' : 'true'
    )
  }, [playerLabelsVisible])

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

  async function onAddBot(botId: BotId) {
    await connectBot(botId, `bot-${uuid()}`, serverPeerId)
  }

  async function onRemovePlayer(id: t.Player['id']) {
    if (!client || !gameState || !adminToken) {
      return
    }

    await client.serverRpc.notify.removePlayer(adminToken, id)
  }

  async function onSettingsChange(settings: Partial<t.GameSettings>) {
    if (!client || !adminToken) {
      return
    }
    await client.serverRpc.changeSettings(adminToken, settings)
  }

  async function onMove(piece: t.CensoredPieceOnBoard) {
    if (!client || !gameState || !isMyTurn()) {
      return
    }

    await client.serverRpc.move(piece.position)
  }

  async function onPush(pushPos: t.PushPosition) {
    if (!client || !gameState || !isMyTurn()) {
      return
    }

    await client.serverRpc.push(pushPos)
  }

  function onClickExtraPiece() {
    if (!client || !gameState || gameState.playerHasPushed) {
      return
    }

    client.serverRpc.setExtraPieceRotation(
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
    void client.serverRpc.setPushPositionHover(boardPos)
  }

  async function onStartGameClick() {
    if (!client || !adminToken) {
      return
    }
    await client.serverRpc.start(adminToken)
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

    await client.serverRpc.restart(adminToken)
  }

  async function onShuffleBoardClick() {
    if (!client || !adminToken) {
      return
    }
    await client.serverRpc.shuffleBoard(adminToken)
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

      <div style={{ flexShrink: 0, width: '100%' }}>
        <MenuBar
          gameState={gameState}
          showAdmin={!_.isUndefined(adminToken)}
          onAddBot={onAddBot}
          onRemovePlayer={onRemovePlayer}
          onStartGameClick={onStartGameClick}
          onRestartGameClick={onRestartGameClick}
          onSettingsChange={onSettingsChange}
          serverPeerId={serverPeerId}
        />
      </div>

      {gameState.stage !== 'setup' && myNextCard && (
        <NextTrophy trophy={myNextCard.trophy} />
      )}

      <div
        style={{
          padding: '0 10px',
          width: '100%',
          display: 'flex',
          flex: 1,
          flexDirection: 'column',
          justifyContent: 'space-between',
          userSelect: 'none',
        }}
      >
        <div
          style={{
            position: 'relative',
            padding: '10px 0',
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            width: '100%',
          }}
        >
          <div
            style={{
              position: 'relative',
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              width: '100%',
            }}
          >
            <BoardComponent
              gameState={gameState}
              extraPiece={gameState.pieceBag[0]}
              players={gameState.players}
              board={gameState.board}
              onMove={onMove}
              onPush={onPush}
              onClickExtraPiece={onClickExtraPiece}
              previousPushPosition={gameState.previousPushPosition}
              lastServerHover={lastServerHover}
              onPushPositionHover={onPushPositionHover}
              isMyTurn={isMyTurn()}
              playerHasPushed={gameState.playerHasPushed}
              playerInTurn={gameState.players[gameState.playerTurn]}
              playerLabelsVisible={playerLabelsVisible}
            />
            {adminToken && gameState.stage === 'setup' && (
              <BoardShuffleIcon onShuffleBoardClick={onShuffleBoardClick} />
            )}
          </div>
        </div>
        <div
          style={{
            padding: '0 15px',
            width: '100%',
            height: '100px',
            flexShrink: 0,
          }}
        >
          <MessageBox messages={messages} />
        </div>
      </div>

      {gameState.stage !== 'setup' && (
        <VisibilityToggle
          visible={playerLabelsVisible}
          onToggle={() => {
            console.log('set')
            setPlayerLabelsVisible(!playerLabelsVisible)
          }}
        />
      )}
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
        zIndex: zIndices.boardShuffleIcon,
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

export default GameClient
