import _ from 'lodash'
import React, { useState } from 'react'
import { useResizeDetector } from 'react-resize-detector'
import Piece, { EmptyPiece, PIECE_MARGIN_PX } from 'src/components/Piece'
import { assertDefined, getPushPosition } from 'src/core/board'
import * as t from 'src/gameTypes'
import {
  CensoredPieceOnBoard,
  ClientGameState,
  PushPosition,
} from 'src/gameTypes'
import {
  boardPushPositionToUIPosition,
  oppositeUIPosition,
  PIECE_SLOTS,
  UIPushPosition,
  UI_PUSH_POSITIONS,
} from 'src/utils/uiUtils'

export type Props = {
  board: ClientGameState['board']
  players: ClientGameState['players']
  // Additional styles for each piece
  boardPiecesStyles?: React.CSSProperties[][]
  onClickPiece: (piece: CensoredPieceOnBoard) => void
  onClickPushPosition: (position: PushPosition) => void
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

const BoardComponent = ({
  board,
  onClickPiece,
  onClickPushPosition,
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
    UI_PUSH_POSITIONS.map(({ x, y, direction }) => {
      const prevUiPos = previousBoardPushPosition
        ? boardPushPositionToUIPosition(previousBoardPushPosition)
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

  return (
    <div
      ref={ref}
      style={{
        position: 'relative',
        padding: `${PIECE_MARGIN_PX}px`,
        width: '100%',
        minWidth: '260px',
        maxWidth: '1000px',
        aspectRatio: '1 / 1',
      }}
    >
      {/*  Background */}
      <div
        style={{
          position: 'absolute',
          background: '#d0cbc6',
          borderRadius: '10px',
          top: `${pieceWidth}px`,
          left: `${pieceWidth}px`,
          width: `${
            (pieceWidth + PIECE_MARGIN_PX) * 7 + PIECE_MARGIN_PX * 3
          }px`,
          height: `${
            (pieceWidth + PIECE_MARGIN_PX) * 7 + PIECE_MARGIN_PX * 3
          }px`,
          // border: '2px solid #CDC5AB',
          aspectRatio: '1 / 1',
        }}
      />
      {pushPlaceholdersForRender.map(({ x, y, direction, style }) => {
        const caretRotation = directionToCaretRotation(direction)

        const position = assertDefined(
          _.find(UI_PUSH_POSITIONS, (p) => p.x === x && p.y === y)
        )
        return (
          <div
            key={`placeholder-${x}-${y}`}
            style={{
              ...style,
              width: `${pieceWidth - pieceWidth * 0.5}px`,
              height: `${pieceWidth - pieceWidth * 0.5}px`,
              margin: `${pieceWidth * 0.25}px`,
              borderRadius: `${pieceWidth * 0.1}px`,
              transition: 'all 800ms ease',
              background: '#f9f9f9',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
            }}
            onMouseOver={() => {
              setLocalPushPositionHover(position)
              onPushPositionHover(position)
            }}
            onClick={onClickExtraPiece}
          >
            <img
              style={{
                width: '40%',
                transform: `rotate(${caretRotation}deg)`,
              }}
              alt=""
              src={`${process.env.PUBLIC_URL}/CaretUp.svg`}
            />
          </div>
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
          onClick={onClickExtraPiece}
          className={`ExtraPiece ${isMyTurn ? 'cursor-pointer' : ''}`}
          style={{
            position: 'absolute',
            top: `${
              PIECE_MARGIN_PX +
              resolvedExtraPiecePos.y * (pieceWidth + PIECE_MARGIN_PX)
            }px`,
            left: `${
              PIECE_MARGIN_PX +
              resolvedExtraPiecePos.x * (pieceWidth + PIECE_MARGIN_PX)
            }px`,
            width: `${pieceWidth}px`,
            height: `${pieceWidth}px`,
            margin: 0,
            padding: 0,
            transition: 'all 800ms ease',
            background: '#eee',
          }}
        >
          <Piece
            style={{
              border: `1px solid transparent`,
              boxShadow: `0px 0px 0px 1.5px ${playerInTurn.color}`,
            }}
            width={pieceWidth}
            piece={extraPiece}
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
          <svg
            className="RotateIcon"
            style={{
              pointerEvents: 'none',
              position: 'absolute',
              zIndex: 10,
              top: '50%',
              left: '50%',
              width: '30%',
              transform: 'translate(-50%, -50%)',
            }}
            viewBox="0 0 55 51"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M53.608 16.9164C53.2837 16.4115 52.8193 16.0141 52.272 15.7756C51.7254 15.5371 51.1207 15.4676 50.5345 15.5765L47.9969 16.0327C45.3354 9.09815 39.7724 3.71263 32.8068 1.32705C25.8404 -1.05854 18.1875 -0.199089 11.9081 3.67394C5.62849 7.54694 1.36899 14.0354 0.275842 21.3918C-0.816638 28.7475 1.36903 36.2155 6.2453 41.7844C11.1216 47.3533 18.1869 50.45 25.5381 50.2408C32.8896 50.0317 39.7715 46.5383 44.3307 40.7016L39.6506 36.9087H39.6499C36.2068 41.2744 31.0452 43.8948 25.5269 44.0789C20.0086 44.2629 14.6876 41.9919 10.967 37.8654C7.24712 33.7388 5.50108 28.1707 6.19004 22.6297C6.87824 17.0887 9.9326 12.1307 14.5468 9.06424C19.1617 5.99756 24.8727 5.12964 30.1745 6.69021C35.4754 8.25 39.8355 12.0814 42.1032 17.1734L39.9323 17.573L39.9316 17.5723C39.15 17.7134 38.4547 18.1603 37.9965 18.8163C37.5385 19.4723 37.3544 20.2844 37.4846 21.0765C37.6149 21.8685 38.0482 22.5768 38.6911 23.0481L45.035 27.4969C45.6928 27.9431 46.4971 28.1114 47.2759 27.9682C48.0547 27.8242 48.7479 27.3795 49.2081 26.7271L53.6064 20.3103C53.9385 19.8082 54.1162 19.2174 54.1162 18.6137C54.1162 18.0093 53.9385 17.4184 53.6064 16.9164L53.608 16.9164Z"
              fill={`#454545`}
            />
          </svg>
        </div>
      }
    </div>
  )
}

export default BoardComponent
