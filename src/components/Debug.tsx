import _ from 'lodash'
import { default as React, useEffect, useState } from 'react'
import { useResizeDetector } from 'react-resize-detector'
import { MessageBox } from 'src/components/MessagesBox'
import PieceComponent, { PIECE_MARGIN_PX } from 'src/components/Piece'
import { PieceOnBoard } from 'src/components/PieceOnBoard'
import { findBestTurn } from 'src/core/bots/bigbrain'
import { systematicRandom } from 'src/core/server/algorithms'
import { getPieceAt } from 'src/core/server/board'
import { createInitialState } from 'src/core/server/game'
import 'src/css/Board.css'
import * as t from 'src/gameTypes'
import { PIECE_SLOTS, UIPushPosition } from 'src/utils/uiUtils'
import { EventEmitter } from 'src/utils/utils'

type AlgoBoard = {
  // Note: player move also encoded within board info
  filledBoard: t.FilledBoard
  extraPiece: t.Piece
  previousPushPosition?: t.PushPosition
}
export const emitter = new EventEmitter()

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

function setPlayerPosition(
  board: t.ClientGameState['board'],
  player: t.CensoredPlayer,
  newPos: t.Position
) {
  const pieces = _.flatten(board.pieces)
  const piece = _.find(pieces, (p) =>
    (p?.players ?? []).some((piecePlayer) => piecePlayer.id === player.id)
  )
  if (piece) {
    // Remove from old piece
    piece.players = piece.players.filter((p) => p.id !== player.id)
  }

  const newPiece = getPieceAt(
    board as unknown as t.FilledBoard,
    newPos
  ) as unknown as t.CensoredPieceOnBoard
  newPiece.players.push(player)
}

const initial = createInitialState()
const shuffled = systematicRandom({
  logger: console,
  level: 'perfect',
})

const ME: t.CensoredPlayer = {
  id: '1',
  name: 'Bot',
  originalName: 'Bot',
  color: t.PlayerColor.Blue,
  currentCards: [],
  censoredCards: [],
}
const FAKE_STATE = {
  stage: 'playing',
  me: ME,
  hasPlayerPushed: false,
  players: [ME],
  playerTurn: 0,
  cards: initial.cards,
  pieceBag: shuffled.pieceBag,
  board: shuffled.board,
  myCurrentCards: [initial.cards.pop()],
} as unknown as t.ClientGameState
setPlayerPosition(FAKE_STATE.board, ME, { x: 0, y: 0 })

export const Debug = () => {
  const [board, setBoard] = useState<AlgoBoard | undefined>(undefined)

  useEffect(() => {
    emitter.addEventListener('board', (board) =>
      setBoard(board as unknown as AlgoBoard)
    )

    findBestTurn(FAKE_STATE)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (!board) {
    return <Container>waiting for board</Container>
  }

  return (
    <Container>
      <div style={{ flexShrink: 0, width: '100%', height: '60px' }}></div>

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
            <Board extraPiece={board.extraPiece} board={board} />
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
          <MessageBox messages={[]} />
        </div>
      </div>
    </Container>
  )
}

export type Props = {
  board: AlgoBoard
  extraPiece: t.Piece
}

const Board = ({ board, extraPiece }: Props) => {
  const { ref, width = 0 } = useResizeDetector()
  const pieceWidth = Math.floor(
    (width - (PIECE_SLOTS - 1) * PIECE_MARGIN_PX) / PIECE_SLOTS
  )

  // This makes sure the board pieces render always in the same order -> no mounting / unmounting
  const sortedPiecesToRender = _.sortBy(
    _.flatten(board.filledBoard.pieces),
    (p) => p.id
  )

  const boardContent = (
    <div>
      <BoardBackground pieceWidth={pieceWidth} />

      <div style={{ position: 'absolute' }}>
        <PieceComponent width={pieceWidth} piece={extraPiece} />
      </div>

      {sortedPiecesToRender.map((piece) => {
        const pieceTransform = getPieceTransform({
          boardPosition: piece.position,
          pieceWidth,
        })

        return (
          <div
            key={piece.id}
            style={{
              transition: 'transform 600ms ease, box-shadow 500ms ease',
              position: 'absolute',
              borderRadius: '5px',
              width: `${pieceWidth}px`,
              height: `${pieceWidth}px`,
              transform: `translate(${pieceTransform.x}px, ${pieceTransform.y}px)`,
            }}
          >
            <PieceOnBoard
              key={piece.id}
              pieceWidth={pieceWidth}
              piece={piece as unknown as t.CensoredPieceOnBoard}
              gameState={FAKE_STATE}
              playerLabelsVisible={true}
            />
          </div>
        )
      })}
    </div>
  )

  return (
    <div
      ref={ref}
      className={'Board'}
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

export default Debug
