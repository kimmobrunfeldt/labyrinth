import _ from 'lodash'
import React, { useState } from 'react'
import { useResizeDetector } from 'react-resize-detector'
import Piece, { EmptyPiece, PIECE_MARGIN_PX } from 'src/components/Piece'
import { RotateIcon } from 'src/components/RotateIcon'
import { BOARD_PUSH_POSITIONS, getPushPosition } from 'src/core/board'
import { centered } from 'src/css'
import * as t from 'src/gameTypes'
import {
  boardPushPositionToUIPosition,
  oppositeUIPosition,
  PIECE_SLOTS,
  UIPushPosition,
  UI_PUSH_POSITIONS,
} from 'src/utils/uiUtils'

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
  pushPositionHover?: UIPushPosition
  isMyTurn: boolean
  playerInTurn: t.CensoredPlayer
  playerHasPushed: boolean
}

function directionToCaretRotation(direction: t.Direction): t.Rotation {
  switch (direction) {
    case 'up':
      return 0
    case 'right':
      return 90
    case 'down':
      return 180
    case 'left':
      return 270
  }
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

const BoardComponent = ({
  gameState,
  board,
  onMove,
  onPush,
  onClickExtraPiece,
  boardPiecesStyles,
  extraPiece,
  previousPushPosition: previousBoardPushPosition,
  onPushPositionHover,
  pushPositionHover,
  isMyTurn,
  playerInTurn,
  playerHasPushed,
}: Props) => {
  const [localPushPositionHover, setLocalPushPositionHover] = useState<
    UIPushPosition | undefined
  >()
  const { ref, width = 0 } = useResizeDetector()

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

  const pushPlaceholdersForRender = _.compact(
    UI_PUSH_POSITIONS.map(({ x, y, direction }) => {
      const prevUiPos = previousBoardPushPosition
        ? boardPushPositionToUIPosition(previousBoardPushPosition)
        : undefined
      const blockedPos = prevUiPos ? oppositeUIPosition(prevUiPos) : undefined
      if (blockedPos && blockedPos.x === x && blockedPos.y === y) {
        return null
      }

      return {
        x,
        y,
        direction,
      }
    })
  )

  function getExtraPiecePosition() {
    const prevUiPos = previousBoardPushPosition
      ? boardPushPositionToUIPosition(previousBoardPushPosition)
      : undefined
    const defaultExtraPiecePos = prevUiPos
      ? oppositeUIPosition(prevUiPos)
      : { x: 0, y: 0 }

    if (playerHasPushed) {
      return defaultExtraPiecePos
    }

    const localOrServer = isMyTurn ? localPushPositionHover : pushPositionHover
    return localOrServer ?? defaultExtraPiecePos
  }

  const resolvedExtraPiecePos = getExtraPiecePosition()

  const content = (
    <>
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

              setLocalPushPositionHover(uiPushPosition)
              onPushPositionHover(uiPushPosition)
            }}
          />
        )
      })}

      {piecesToRender.map((toRender) => {
        const key =
          toRender.type === 'board'
            ? toRender.piece?.id ?? `empty-${toRender.x}-${toRender.y}`
            : toRender.extraPiece.id

        let content: JSX.Element
        if (toRender.type === 'extra') {
          content = (
            <ExtraPiece
              key={toRender.extraPiece.id}
              onClickExtraPiece={onClickExtraPiece}
              position={resolvedExtraPiecePos}
              isMyTurn={isMyTurn}
              pieceWidth={pieceWidth}
              playerInTurn={playerInTurn}
              piece={extraPiece}
              playing={gameState.stage === 'playing'}
              playerHasPushed={playerHasPushed}
            />
          )
        } else {
          const { piece } = toRender

          if (!piece) {
            content = <EmptyPiece width={pieceWidth} />
          } else {
            content = (
              <BoardPiece
                key={piece.id}
                pieceWidth={pieceWidth}
                piece={piece}
                playerInTurn={playerInTurn}
                playerHasPushed={playerHasPushed}
                onClick={() => {
                  if (playerHasPushed) {
                    onMove(piece)
                  } else {
                    onPush(getPushPosition(piece.position))
                  }
                }}
                onMouseOver={() => {
                  if (gameState.stage !== 'playing') {
                    return
                  }

                  const boardPushPos = BOARD_PUSH_POSITIONS.find(
                    (p) => p.x === piece.position.x && p.y === piece.position.y
                  )
                  if (!boardPushPos) {
                    return
                  }

                  const uiPushPos = boardPushPositionToUIPosition(boardPushPos)
                  setLocalPushPositionHover(uiPushPos)
                  onPushPositionHover(uiPushPos)
                }}
              />
            )
          }
        }

        const style: React.CSSProperties =
          toRender.type === 'board'
            ? {
                ...(boardPiecesStyles?.[toRender.y]?.[toRender.x] || {}),
                transform: `translate(${
                  PIECE_MARGIN_PX +
                  (toRender.x + 1) * (pieceWidth + PIECE_MARGIN_PX)
                }px, ${
                  PIECE_MARGIN_PX +
                  (toRender.y + 1) * (pieceWidth + PIECE_MARGIN_PX)
                }px)`,
              }
            : {
                transform: `translate(${
                  PIECE_MARGIN_PX +
                  resolvedExtraPiecePos.x * (pieceWidth + PIECE_MARGIN_PX)
                }px, ${
                  PIECE_MARGIN_PX +
                  resolvedExtraPiecePos.y * (pieceWidth + PIECE_MARGIN_PX)
                }px)`,
              }
        return (
          <div
            style={{
              ...style,
              transition: 'transform 600ms ease',
              position: 'absolute',
            }}
            key={key}
          >
            {content}
          </div>
        )
      })}
    </>
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
        maxHeight: '80vh',
        aspectRatio: '1 / 1',
      }}
    >
      {width === 0 ? null : content}
    </div>
  )
}

type BoardPieceProps = {
  onClick: React.DOMAttributes<HTMLDivElement>['onClick']
  onMouseOver: React.DOMAttributes<HTMLDivElement>['onMouseOver']
  piece: t.CensoredPieceOnBoard
  style?: React.CSSProperties
  pieceWidth: number
  playerInTurn: t.CensoredPlayer
  playerHasPushed: boolean
}

const BoardPiece = ({
  onClick,
  onMouseOver,
  piece,
  style = {},
  pieceWidth,
  playerInTurn,
  playerHasPushed,
}: BoardPieceProps) => (
  <div
    onClick={onClick}
    onMouseOver={onMouseOver}
    style={{
      ...style,
      width: `${pieceWidth}px`,
      height: `${pieceWidth}px`,
      position: 'absolute',
      margin: 0,
      padding: 0,
    }}
  >
    <Piece
      width={pieceWidth}
      style={{
        position: 'absolute',
      }}
      piece={piece}
    />
    {piece.players.length > 0 &&
      piece.players.map((player, index) => {
        const cardsFound = _.sumBy(player.censoredCards, (c) =>
          c.found ? 1 : 0
        )
        const isPlayerTurn = playerInTurn.id === player.id

        return (
          <div
            title={`${player.name}, ${cardsFound} / ${player.censoredCards.length} found`}
            key={player.id}
            style={{
              top: '50%',
              left: '50%',
              transform: `translate(calc(-50% + ${index * 3}px), calc(-50% + ${
                index * 3
              }px))`,
              height: '30%',
              width: '30%',
              opacity: piece.trophy ? 0.8 : 1,
              borderRadius: '9999px',
              background: player.color,
              position: 'absolute',
              ...(playerHasPushed && isPlayerTurn
                ? {
                    border: `2px solid white`,
                    boxShadow: `0px 0px 0px 1.5px ${playerInTurn.color}`,
                  }
                : {}),
            }}
          />
        )
      })}
  </div>
)

type PushPositionProps = {
  uiPushPosition: UIPushPosition
  pieceWidth: number
  onMouseOver: React.DOMAttributes<HTMLDivElement>['onMouseOver']
}

const PushPosition = ({
  pieceWidth,
  uiPushPosition,
  onMouseOver,
}: PushPositionProps) => (
  <div
    style={{
      position: 'absolute',
      transform: `translate(${
        PIECE_MARGIN_PX + uiPushPosition.x * (pieceWidth + PIECE_MARGIN_PX)
      }px, ${
        PIECE_MARGIN_PX + uiPushPosition.y * (pieceWidth + PIECE_MARGIN_PX)
      }px)`,
      width: `${pieceWidth}px`,
      height: `${pieceWidth}px`,
      transition: 'transform 600ms ease',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
    }}
    onMouseOver={onMouseOver}
  >
    <div
      style={{
        ...centered(),
        width: '50%',
        height: '50%',
        background: '#f9f9f9',
        borderRadius: `${pieceWidth * 0.1}px`,
      }}
    ></div>
    <img
      style={{
        ...centered(
          `rotate(${directionToCaretRotation(uiPushPosition.direction)}deg)`
        ),
        width: '20%',
      }}
      alt=""
      src={`${process.env.PUBLIC_URL}/CaretUp.svg`}
    />
  </div>
)

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

type ExtraPieceProps = {
  onClickExtraPiece: () => void
  position: t.Position
  pieceWidth: number
  piece: t.Piece
  isMyTurn: boolean
  playerHasPushed: boolean
  playing: boolean
  playerInTurn: t.CensoredPlayer
}
const ExtraPiece = ({
  onClickExtraPiece,
  isMyTurn,
  pieceWidth,
  playing,
  piece,
  playerInTurn,
  playerHasPushed,
}: ExtraPieceProps) => (
  <div
    onClick={() => playing && onClickExtraPiece()}
    className={`ExtraPiece ${
      isMyTurn && playing && !playerHasPushed ? 'cursor-pointer' : ''
    }`}
    style={{
      userSelect: 'none',
      position: 'absolute',
      width: `${pieceWidth}px`,
      height: `${pieceWidth}px`,
      margin: 0,
      padding: 0,
      background: '#eee',
    }}
  >
    <Piece
      style={{
        border: `1px solid transparent`,
        transition: 'all 200ms ease',
        boxShadow: `0px 0px 0px 1.5px ${
          playing && !playerHasPushed ? playerInTurn.color : '#aaa'
        }`,
      }}
      width={pieceWidth}
      piece={piece}
    />
    <div
      className="ExtraPiece__fader"
      style={{
        borderRadius: '5px',
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        background: 'white',
      }}
    />
    <RotateIcon
      fill="#454545"
      style={{
        pointerEvents: 'none',
        position: 'absolute',
        zIndex: 10,
        top: '50%',
        left: '50%',
        width: '30%',
        transform: 'translate(-50%, -50%)',
      }}
    />
  </div>
)

export default BoardComponent
