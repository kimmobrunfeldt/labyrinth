import _ from 'lodash'
import React, { useState } from 'react'
import { useResizeDetector } from 'react-resize-detector'
import Piece, { EmptyPiece, PIECE_MARGIN_PX } from 'src/components/Piece'
import { assertDefined, getPushPosition, pushPositions } from 'src/core/board'
import * as t from 'src/gameTypes'
import {
  CensoredPieceOnBoard,
  ClientGameState,
  PushPosition,
} from 'src/gameTypes'
import { oppositeIndex } from 'src/utils/utils'

const PIECES_IN_A_ROW = 7
// Accounts for the empty piece placeholders in the edges
const PIECE_SLOTS = PIECES_IN_A_ROW + 2

type UIPushPlaceHolderPosition = {
  x: number
  y: number
  direction: t.Direction
}

const pushPositionPlaceholders: UIPushPlaceHolderPosition[] = [
  // top
  { x: 2, y: 0, direction: 'down' },
  { x: 4, y: 0, direction: 'down' },
  { x: 6, y: 0, direction: 'down' },
  // right
  { x: 8, y: 2, direction: 'left' },
  { x: 8, y: 4, direction: 'left' },
  { x: 8, y: 6, direction: 'left' },
  // bottom
  { x: 6, y: 8, direction: 'up' },
  { x: 4, y: 8, direction: 'up' },
  { x: 2, y: 8, direction: 'up' },
  // left
  { x: 0, y: 6, direction: 'right' },
  { x: 0, y: 4, direction: 'right' },
  { x: 0, y: 2, direction: 'right' },
]

function boardPushPositionToUIPosition(
  pos: t.Position
): UIPushPlaceHolderPosition {
  const index = _.findIndex(
    pushPositions,
    (pPos) => pPos.x === pos.x && pPos.y === pos.y
  )
  return pushPositionPlaceholders[index]
}

function oppositeUIPosition(
  uiPos: UIPushPlaceHolderPosition
): UIPushPlaceHolderPosition {
  switch (uiPos.direction) {
    case 'up':
    case 'down':
      return { ...uiPos, y: oppositeIndex(PIECE_SLOTS, uiPos.y) }
    case 'right':
    case 'left':
      return { ...uiPos, x: oppositeIndex(PIECE_SLOTS, uiPos.x) }
  }
}

export type Props = {
  board: ClientGameState['board']
  players: ClientGameState['players']
  // Additional styles for each piece
  boardPiecesStyles?: React.CSSProperties[][]
  onClickPiece: (piece: CensoredPieceOnBoard) => void
  onClickPushPosition: (position: PushPosition) => void
  onClickExtraPiece: () => void
  extraPiece: t.Piece
  previousPushPosition?: t.PushPosition
}

const BoardComponent = ({
  board,
  onClickPiece,
  onClickPushPosition,
  onClickExtraPiece,
  boardPiecesStyles,
  extraPiece,
  previousPushPosition,
}: Props) => {
  const [placeholderHover, setPlaceholderHover] = useState<
    UIPushPlaceHolderPosition | undefined
  >()
  const { ref, width = 0 } = useResizeDetector()

  const pieceWidth = Math.floor(
    (width - (PIECE_SLOTS - 1) * PIECE_MARGIN_PX) / PIECE_SLOTS
  )
  const piecesForRender = _.flatten(
    board.pieces.map((row, y) =>
      row.map((piece, x) => {
        const style: React.CSSProperties = {
          ...(boardPiecesStyles?.[y]?.[x] || {}),
          position: 'absolute',
          top: `${
            PIECE_MARGIN_PX + (y + 1) * (pieceWidth + PIECE_MARGIN_PX)
          }px`,
          left: `${
            PIECE_MARGIN_PX + (x + 1) * (pieceWidth + PIECE_MARGIN_PX)
          }px`,
        }
        return {
          piece,
          style,
          x,
          y,
        }
      })
    )
  )

  const pushPlaceholdersForRender = _.compact(
    pushPositionPlaceholders.map(({ x, y }) => {
      const prevUiPos = previousPushPosition
        ? boardPushPositionToUIPosition(previousPushPosition)
        : undefined
      const blockedPos = prevUiPos ? oppositeUIPosition(prevUiPos) : undefined
      if (blockedPos && blockedPos.x === x && blockedPos.y === y) {
        return null
      }

      const style: React.CSSProperties = {
        position: 'absolute',
        top: `${PIECE_MARGIN_PX + y * (pieceWidth + PIECE_MARGIN_PX)}px`,
        left: `${PIECE_MARGIN_PX + x * (pieceWidth + PIECE_MARGIN_PX)}px`,
      }

      return {
        style,
        x,
        y,
      }
    })
  )

  return (
    <div
      ref={ref}
      style={{
        position: 'relative',
        background: '#FFFCF3',
        borderRadius: '10px',
        padding: `${PIECE_MARGIN_PX}px`,
        border: '5px solid #CDC5AB',
        width: '100%',
        aspectRatio: '1 / 1',
      }}
    >
      {pushPlaceholdersForRender.map(({ x, y, style }) => {
        const commonStyle = {
          ...style,
          width: `${pieceWidth}px`,
          height: `${pieceWidth}px`,
          margin: 0,
          padding: '8px',
          transition: 'all 800ms ease',
          background: '#eee',
        }

        const placeholder = assertDefined(
          _.find(pushPositionPlaceholders, (p) => p.x === x && p.y === y)
        )
        return (
          <div
            key={`placeholder-${x}-${y}`}
            style={commonStyle}
            onMouseOver={() => setPlaceholderHover(placeholder)}
            onClick={onClickExtraPiece}
          ></div>
        )
      })}

      {piecesForRender.map(({ piece, style, x, y }) => {
        if (!piece) {
          return (
            <EmptyPiece
              width={pieceWidth}
              key={`empty-${x}-${y}`}
              style={style}
            />
          )
        }

        return (
          <div
            onClick={() => {
              onClickPiece(piece)
              onClickPushPosition(getPushPosition(piece.position))
            }}
            key={piece.id}
            style={{
              ...style,
              width: `${pieceWidth}px`,
              height: `${pieceWidth}px`,
              position: 'absolute',
              margin: 0,
              padding: 0,
              transition: 'all 800ms ease',
            }}
          >
            <Piece
              width={pieceWidth}
              style={{
                position: 'absolute',
              }}
              piece={piece}
            />
            {/* todo multiple players */}
            {piece.players.length > 0 &&
              piece.players.map((player, index) => (
                <div
                  key={player.id}
                  style={{
                    top: `${40 + index * 2}%`,
                    left: `${40 + index * 2}%`,
                    height: '16px',
                    width: '16px',
                    background: player.color,
                    position: 'absolute',
                  }}
                />
              ))}
          </div>
        )
      })}
      {
        <div
          style={{
            position: 'absolute',
            top: `${
              PIECE_MARGIN_PX +
              (placeholderHover?.y ?? 0) * (pieceWidth + PIECE_MARGIN_PX)
            }px`,
            left: `${
              PIECE_MARGIN_PX +
              (placeholderHover?.x ?? 0) * (pieceWidth + PIECE_MARGIN_PX)
            }px`,
            width: `${pieceWidth}px`,
            height: `${pieceWidth}px`,
            margin: 0,
            padding: 0,
            transition: 'all 800ms ease',
            background: '#eee',
          }}
          // onMouseOut={() => setPlaceholderHover(undefined)}
        >
          <Piece
            width={pieceWidth}
            onClick={onClickExtraPiece}
            piece={extraPiece}
          />
        </div>
      }
    </div>
  )
}

export default BoardComponent
