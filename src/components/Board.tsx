import _ from 'lodash'
import React, { useState } from 'react'
import { useResizeDetector } from 'react-resize-detector'
import { ExtraPiece } from 'src/components/ExtraPiece'
import { CaretUp } from 'src/components/Icons'
import { EmptyPiece, PIECE_MARGIN_PX } from 'src/components/Piece'
import { PieceOnBoard } from 'src/components/PieceOnBoard'
import { PushPosition } from 'src/components/PushPosition'
import { getPushPosition } from 'src/core/server/board'
import { centered } from 'src/css'
import 'src/css/Board.css'
import * as t from 'src/gameTypes'
import {
  boardPushPositionToUIPosition,
  directionToCaretRotation,
  getIsMyTurn,
  hex2rgba,
  isBlockedBoardPushPosition,
  isBlockedUiPushPosition,
  PIECE_SLOTS,
  resolveExtraPiecePosition,
  UIPushPosition,
  UI_PUSH_POSITIONS,
} from 'src/utils/uiUtils'
import { zIndices } from 'src/zIndices'

export type Props = {
  gameState: t.ClientGameState
  board: t.ClientGameState['board']
  players: t.ClientGameState['players']
  // Additional styles for each piece
  boardPiecesStyles?: React.CSSProperties[][]
  onMove: (piece: t.CensoredPieceOnBoard) => void
  onPush: (position: t.PushPosition) => void
  onPushPositionHover: (position?: UIPushPosition) => void
  onClickExtraPiece: () => void
  extraPiece: t.Piece
  previousPushPosition?: t.PushPosition
  lastServerHover?: UIPushPosition
  isMyTurn: boolean
  playerInTurn: t.CensoredPlayer
  playerHasPushed: boolean
}

type PieceToRender =
  | {
      type: 'board'
      piece: t.CensoredPieceOnBoard | null
      x: number
      y: number
    }
  | {
      type: 'extra'
      extraPiece: t.Piece
    }

const Board = ({
  gameState,
  onMove,
  onPush,
  onClickExtraPiece,
  boardPiecesStyles,
  extraPiece,
  onPushPositionHover,
  lastServerHover,
}: Props) => {
  const [lastLocalHover, setLastLocalHover] = useState<
    UIPushPosition | undefined
  >()
  const [hoveringPushPosition, setHoveringPushPosition] = useState<boolean>()
  const { ref, width = 0 } = useResizeDetector()
  const { playerHasPushed, board } = gameState
  const isMyTurn = getIsMyTurn(gameState)
  const pieceWidth = Math.floor(
    (width - (PIECE_SLOTS - 1) * PIECE_MARGIN_PX) / PIECE_SLOTS
  )
  const piecesToRender: Array<PieceToRender> = _.flatten(
    board.pieces.map((row, y) =>
      row.map((piece, x) => {
        return { type: 'board', piece, x, y }
      })
    )
  )
  piecesToRender.push({ type: 'extra', extraPiece })
  // This makes sure the board pieces render always in the same order -> no mounting / unmounting
  const sortedPiecesToRender = _.sortBy(piecesToRender, (p) =>
    p.type === 'extra' ? p.extraPiece.id : p.piece?.id
  )
  const pushPlaceholdersForRender = _.compact(
    UI_PUSH_POSITIONS.map(({ x, y, direction }) => {
      const isBlocked = isBlockedUiPushPosition(gameState, { x, y })
      if (isBlocked) {
        return null
      }

      return {
        x,
        y,
        direction,
      }
    })
  )

  const boardContent = (
    <div>
      <BoardBackground pieceWidth={pieceWidth} />

      {pushPlaceholdersForRender.map((uiPushPosition) => {
        return (
          <PushPosition
            key={`push-${uiPushPosition.x}-${uiPushPosition.y}`}
            pieceWidth={pieceWidth}
            uiPushPosition={uiPushPosition}
            onMouseOver={() => {
              if (gameState.stage !== 'playing') {
                return
              }

              setLastLocalHover(uiPushPosition)
              onPushPositionHover(uiPushPosition)
              setHoveringPushPosition(true)
            }}
            onMouseOut={() => {
              setHoveringPushPosition(false)
            }}
          />
        )
      })}

      {sortedPiecesToRender.map((toRender) => {
        // Absolutely horrible code coming up
        // The idea is to try to keep the piece container always render in DOM
        // so that the position transforms are fast CSS transitions
        const key =
          toRender.type === 'board'
            ? toRender.piece?.id ?? `empty-${toRender.x}-${toRender.y}`
            : toRender.extraPiece.id

        let content: JSX.Element
        let containerStyle: React.CSSProperties

        if (toRender.type === 'extra') {
          const extra = getExtraPieceContent({
            toRender,
            gameState,
            extraPiece,
            onClickExtraPiece,
            pieceWidth,
            setHoveringPushPosition,
            lastServerHover,
            lastLocalHover,
          })

          content = extra.content
          containerStyle = extra.containerStyle
        } else {
          const { piece } = toRender
          const pieceTransform = getPieceTransform({
            boardPosition: toRender,
            pieceWidth,
          })
          containerStyle = {
            ...(boardPiecesStyles?.[toRender.y]?.[toRender.x] || {}),
            transform: `translate(${pieceTransform.x}px, ${pieceTransform.y}px)`,
          }

          if (!piece) {
            content = <EmptyPiece width={pieceWidth} />
          } else {
            // toRender uses board coodrinates
            const isBlocked = isBlockedBoardPushPosition(gameState, toRender)
            const uiPushPos = boardPushPositionToUIPosition(toRender)

            // Should we interact in general? Some hovers still need to consider blockage separately.
            const shouldInteract =
              gameState.stage === 'playing' && !playerHasPushed

            const isBeingHovered =
              hoveringPushPosition &&
              uiPushPos &&
              lastLocalHover &&
              lastLocalHover.x === uiPushPos.x &&
              lastLocalHover.y === uiPushPos.y

            const alpha = isBeingHovered ? 1 : 0.5

            const newTransform = getPieceTransform({
              boardPosition: toRender,
              pieceWidth,
              hoverUiPushPosition:
                shouldInteract &&
                hoveringPushPosition &&
                lastLocalHover &&
                isMyTurn
                  ? lastLocalHover
                  : undefined,
            })
            containerStyle = {
              ...containerStyle,
              ...(piece.players.length > 0
                ? { zIndex: zIndices.pieceWhenPlayerOnIt }
                : {}),
              ...(!playerHasPushed
                ? {
                    transform: `translate(${newTransform.x}px, ${newTransform.y}px)`,
                  }
                : {}),
              cursor: isBlocked
                ? 'not-allowed'
                : uiPushPos && shouldInteract && isMyTurn
                ? 'pointer'
                : 'default',

              boxShadow:
                shouldInteract && isBeingHovered && isMyTurn && !isBlocked
                  ? `0 0 0 2px ${hex2rgba(gameState.me.color, alpha)}`
                  : `0 0 0 2px transparent`,
            }

            const showCaret =
              shouldInteract && isBeingHovered && isMyTurn && !isBlocked
            content = (
              <div
                style={{
                  position: 'relative',
                  width: '100%',
                  height: '100%',
                }}
              >
                <PieceOnBoard
                  key={piece.id}
                  pieceWidth={pieceWidth}
                  piece={piece}
                  gameState={gameState}
                  onClick={() => {
                    if (playerHasPushed) {
                      onMove(piece)
                    } else {
                      onPush(getPushPosition(piece.position))
                    }
                  }}
                  onMouseOver={() => {
                    if (
                      gameState.stage !== 'playing' ||
                      !uiPushPos ||
                      isBlocked
                    ) {
                      return
                    }

                    setHoveringPushPosition(true)
                    setLastLocalHover(uiPushPos)
                    onPushPositionHover(uiPushPos)
                  }}
                  onMouseOut={() => setHoveringPushPosition(false)}
                />

                <CaretUp
                  style={{
                    ...centered(
                      uiPushPos
                        ? `rotate(${directionToCaretRotation(
                            uiPushPos.direction
                          )}deg)`
                        : undefined
                    ),
                    pointerEvents: 'none',
                    transition: 'all 400ms ease',
                    width: '20%',
                    opacity: showCaret ? 1 : 0,
                  }}
                  fill={gameState.me.color}
                />
              </div>
            )
          }
        }

        return (
          <div
            key={key}
            style={{
              transition: 'transform 600ms ease, box-shadow 500ms ease',
              position: 'absolute',
              borderRadius: '5px',
              width: `${pieceWidth}px`,
              height: `${pieceWidth}px`,
              ...containerStyle,
            }}
          >
            {content}
          </div>
        )
      })}
    </div>
  )

  return (
    <div
      ref={ref}
      className={[
        'Board',
        isMyTurn ? 'Board--myturn' : '',
        gameState.stage === 'playing' ? 'Board--playing' : '',
        gameState.playerHasPushed ? 'Board--has-pushed' : '',
      ].join(' ')}
      style={{
        position: 'relative',
        padding: `${PIECE_MARGIN_PX}px`,
        width: '100%',
        margin: '0 auto',
        minWidth: '260px',
        maxWidth: '800px',
        maxHeight: '75vh',
        aspectRatio: '1 / 1',
      }}
    >
      {width === 0 ? null : boardContent}
    </div>
  )
}

function getPieceTransform({
  boardPosition,
  pieceWidth,
  hoverUiPushPosition,
}: {
  boardPosition: t.Position
  pieceWidth: number
  hoverUiPushPosition?: UIPushPosition
}) {
  const uiPosition = { x: boardPosition.x + 1, y: boardPosition.y + 1 }
  const start = {
    x: PIECE_MARGIN_PX + uiPosition.x * (pieceWidth + PIECE_MARGIN_PX),
    y: PIECE_MARGIN_PX + uiPosition.y * (pieceWidth + PIECE_MARGIN_PX),
  }
  if (!hoverUiPushPosition) {
    return start
  }
  const axis = ['up', 'down'].includes(hoverUiPushPosition.direction)
    ? 'x'
    : 'y'
  if (uiPosition[axis] !== hoverUiPushPosition[axis]) {
    return start
  }

  const multiplier = ['down', 'right'].includes(hoverUiPushPosition.direction)
    ? 1
    : -1
  return {
    x: start.x + (axis === 'y' ? multiplier * 6 : 0),
    y: start.y + (axis === 'x' ? multiplier * 6 : 0),
  }
}

function getExtraPieceContent({
  lastServerHover,
  lastLocalHover,
  pieceWidth,
  onClickExtraPiece,
  extraPiece,
  gameState,
  setHoveringPushPosition,
}: {
  lastServerHover?: UIPushPosition
  lastLocalHover?: UIPushPosition
  toRender: PieceToRender
  pieceWidth: number
  onClickExtraPiece: Props['onClickExtraPiece']
  extraPiece: t.Piece
  gameState: t.ClientGameState
  setHoveringPushPosition: (val: boolean) => void
}) {
  const resolvedPosition = resolveExtraPiecePosition(
    gameState,
    lastServerHover,
    lastLocalHover
  )
  return {
    containerStyle: {
      transform: `translate(${
        PIECE_MARGIN_PX + resolvedPosition.x * (pieceWidth + PIECE_MARGIN_PX)
      }px, ${
        PIECE_MARGIN_PX + resolvedPosition.y * (pieceWidth + PIECE_MARGIN_PX)
      }px)`,
      zIndex: zIndices.extraPiece,
    } as React.CSSProperties,
    content: (
      <ExtraPiece
        key={extraPiece.id}
        gameState={gameState}
        onClickExtraPiece={onClickExtraPiece}
        onMouseOver={() => setHoveringPushPosition(true)}
        onMouseOut={() => setHoveringPushPosition(false)}
        position={resolvedPosition}
        pieceWidth={pieceWidth}
        piece={extraPiece}
      />
    ),
  }
}

const BoardBackground = ({ pieceWidth }: { pieceWidth: number }) => (
  <div
    style={{
      position: 'absolute',
      background: '#d0cbc6',
      borderRadius: '10px',
      top: `${pieceWidth}px`,
      left: `${pieceWidth}px`,
      width: `${(pieceWidth + PIECE_MARGIN_PX) * 7 + PIECE_MARGIN_PX * 5}px`,
      height: `${(pieceWidth + PIECE_MARGIN_PX) * 7 + PIECE_MARGIN_PX * 5}px`,
    }}
  />
)

export default Board
