import _ from 'lodash'
import React, { useEffect, useRef, useState } from 'react'
import BoardComponent from 'src/components/Board'
import MenuBar from 'src/components/MenuBar'
import { getNewRotation, getPushPosition } from 'src/core/board'
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
import { EventEmitter, uuid } from 'src/utils/utils'
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
  const bots = useRef<Array<t.PromisifyMethods<t.ServerRpcAPI>>>([])
  const emitter = useRef(new EventEmitter())

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
              'onClickPushPosition',
              _.once((pos) => {
                resolve(pos)
              })
            )
          })

          return getPushPosition(pos as Position)
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
    connectBot(`bot-${uuid()}`, { peerId: serverPeerId })
  }

  function onClickPiece(piece: t.CensoredPieceOnBoard) {
    emitter.current.dispatch('onClickPiece', { piece })
  }

  function onClickPushPosition(position: t.Position) {
    emitter.current.dispatch('onClickPushPosition', position)
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

    if (!isMyTurn() || gameState.playerHasPushed) {
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

  return (
    <div>
      <MenuBar
        gameState={gameState}
        showAdmin={Boolean(adminToken)}
        onAddBotClick={onAddBot}
        onStartGameClick={onStartGameClick}
        serverPeerId={serverPeerId}
      />

      <Container {...containerProps}>
        {gameState && (
          <BoardComponent
            extraPiece={gameState.pieceBag[0]}
            players={gameState.players}
            board={gameState.board}
            onClickPiece={onClickPiece}
            onClickPushPosition={onClickPushPosition}
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
