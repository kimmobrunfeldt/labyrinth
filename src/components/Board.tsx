import _ from 'lodash'
import React, { useEffect, useState } from 'react'
import Piece, {
  EmptyPiece,
  PIECE_MARGIN_PX,
  PIECE_WIDTH,
} from 'src/components/Piece'
import {
  addPiece,
  assertDefined,
  changeRandomPiece,
  createRingBuffer,
  emptyPiecesCount,
  fill,
  fillBoard,
  filledPiecesCount,
  findSubgraphsWithMoreThanXConnectedVertices,
  getConnectedCornerNeighbors,
  getWeightedRandomPieceIndex,
  isLockedPiece,
  maybeGetPieceAt,
  popIndex,
  randomFreePieceToRotate,
  removePiece,
  removeRandomPiece,
  rotatePiece,
} from 'src/core/board'
import { createBoard, createPieces } from 'src/core/pieces'
import {
  Board as BoardType,
  FilledBoard,
  NonEmptyArray,
  Piece as PieceType,
  Position,
  PositionPiece,
  Subgraph,
} from 'src/core/types'

type Ui = {
  setBoard: React.Dispatch<React.SetStateAction<BoardType>>
  setBoardUi: React.Dispatch<
    React.SetStateAction<
      {
        opacity: number
      }[][]
    >
  >
  markPieces: (pieces: PositionPiece[]) => void
}

export const Board = () => {
  const [board, setBoard] = useState<BoardType>(createBoard())
  const [boardUi, setBoardUi] = useState<{ opacity: number }[][]>(
    board.map((row) => row.map(() => ({ opacity: 1 })))
  )

  function markPieces(pieces: PositionPiece[]) {
    const newBoardUi = _.cloneDeep(boardUi).map((row) =>
      row.map(() => ({ opacity: 0.2 }))
    )
    const markedBoardUi = newBoardUi.map((row, y) =>
      row.map((p1, x) => {
        const shouldMark = pieces.some(
          (p2) => p2.position.x === x && p2.position.y === y
        )
        return shouldMark ? { opacity: 1 } : newBoardUi[y][x]
      })
    )
    setBoardUi(markedBoardUi)
  }

  function onClickPiece(position: Position) {
    const clickedPiece = maybeGetPieceAt(board, position)
    if (!clickedPiece) {
      console.log('No piece')
      return
    }
    const newBoardUi = _.cloneDeep(boardUi).map((row) =>
      row.map(() => ({ opacity: 0.5 }))
    )

    const pieces = fill(board, new Set<PositionPiece>([clickedPiece]))
    pieces.forEach((p) => {
      newBoardUi[p.position.y][p.position.x] = { opacity: 1 }
    })

    setBoardUi(newBoardUi)
  }

  useEffect(() => {
    const ui: Ui = {
      setBoard,
      setBoardUi,
      markPieces,
    }
    // random(ui)

    // console.log('systematic')
    // systematic(ui)
    console.log('systematic2')
    systematic2(ui)
  }, [])

  return (
    <div
      style={{
        position: 'relative',
        background: '#FFFCF3',
        borderRadius: '10px',
        width: `${PIECE_WIDTH * 7 + PIECE_MARGIN_PX * 6}px`,
        height: `${PIECE_WIDTH * 7 + PIECE_MARGIN_PX * 6}px`,
        padding: '5px',
        border: '5px solid #CDC5AB',
      }}
    >
      {board.map((row, y) => {
        return (
          <React.Fragment key={y}>
            {row.map((piece, x) => {
              const isLastX = x === row.length - 1
              const isLastY = y === board.length - 1
              const marginRight = isLastX ? 0 : PIECE_MARGIN_PX
              const marginBottom = isLastY ? 0 : PIECE_MARGIN_PX

              const style: React.CSSProperties = {
                ...boardUi[y][x],
                position: 'absolute',
                top: `${
                  PIECE_MARGIN_PX + y * (PIECE_WIDTH + PIECE_MARGIN_PX)
                }px`,
                left: `${
                  PIECE_MARGIN_PX + x * (PIECE_WIDTH + PIECE_MARGIN_PX)
                }px`,
                marginBottom,
                marginRight,
              }

              if (!piece) {
                return (
                  <EmptyPiece
                    key={`${y}-${x}`}
                    style={style}
                    position={{ x, y }}
                  />
                )
              }

              return (
                <Piece
                  key={`${y}-${x}-${piece.type}-${piece.rotation}`}
                  style={style}
                  {...piece}
                />
              )
            })}
          </React.Fragment>
        )
      })}
    </div>
  )
}

async function random({ setBoard, markPieces }: Ui) {
  while (true) {
    const pieces = createPieces()
    const board = fillBoard(createBoard(), { pieces }) as FilledBoard

    // await new Promise((resolve) => setTimeout(resolve, 200))
    for (let i = 0; i < 1000; ++i) {
      setBoard(board)

      const offending = findSubgraphsWithMoreThanXConnectedVertices(board, 2)
      markPieces(_.flatten(offending))

      if (offending.length === 0) {
        return
      }

      if (offending.length > 0) {
        // When there are offending subgraphs, we know they contain pieces
        const random = assertDefined(randomFreePieceToRotate(offending))
        rotatePiece(board, random.position)
      }

      // To make the algorithm async
      await new Promise((resolve) => setTimeout(resolve, 0))
    }
  }
}

async function systematic({ setBoard }: Ui) {
  let board: BoardType
  let pieces: PieceType[]

  do {
    console.log('new loop')
    pieces = createPieces()
    board = createBoard()
    let placementTries = 0

    while (emptyPiecesCount(board) > 0) {
      // To make the algorithm async
      await new Promise((resolve) => setTimeout(resolve, 5))
      setBoard([...board])

      // Since the board has empty slots -> pieces array must be non-empty
      // as there will always be one piece left even after complete filling
      const index = getWeightedRandomPieceIndex(
        pieces as NonEmptyArray<PieceType>
      )
      const piece = popIndex(pieces as NonEmptyArray<PieceType>, index)
      const addedPiece = addPiece(board, piece)

      setBoard([...board])

      const offending = findSubgraphsWithMoreThanXConnectedVertices(board, 2)
      const cornerOffenders = getConnectedCornerNeighbors(board)
      const offendingShufflable = _.flatten(offending)
        .concat(cornerOffenders)
        .filter((p) => !isLockedPiece(p.position))

      if (offending.length === 0 && cornerOffenders.length) {
        console.log('Piece ok')
        placementTries = 0
        continue
      } else {
        console.log('Piece placement not ok, trying again..')
        // Otherwise revert the last addition and try again
        const { position: _position, ...removedPiece } = assertDefined(
          removePiece(board, addedPiece.position)
        )
        setBoard([...board])
        pieces.push(removedPiece)
        placementTries++
      }

      if (placementTries > 100) {
        console.log('Too many retries for one piece, starting over')
        // The situation seems stalled, try again
        break
      }
    }

    setBoard(board)
  } while (emptyPiecesCount(board) > 0)
}

async function systematic2({ setBoard }: Ui) {
  const board = createBoard()
  const pieces = createPieces()
  const maxBuffer = 10
  const noSolutions = createRingBuffer<number>({ max: maxBuffer })

  while (emptyPiecesCount(board) > 0) {
    // To make the algorithm async
    await new Promise((resolve) => setTimeout(resolve, 10))
    setBoard([...board])

    // Since the board has empty slots -> pieces array must be non-empty
    // as there will always be one piece left even after complete filling
    const index = getWeightedRandomPieceIndex(
      pieces as NonEmptyArray<PieceType>
    )
    const piece = popIndex(pieces as NonEmptyArray<PieceType>, index)
    addPiece(board, piece)

    let offendingSubgraphs: Subgraph[]
    let offendingCorners: PositionPiece[]
    let offendingChangeable: PositionPiece[]
    let foundSolution = false

    for (let tries = 0; tries < 50; ++tries) {
      setBoard([...board])

      offendingSubgraphs = findSubgraphsWithMoreThanXConnectedVertices(board, 2)
      offendingCorners = getConnectedCornerNeighbors(board)
      offendingChangeable = _.uniqBy(
        _.flatten(offendingSubgraphs)
          .concat(offendingCorners)
          .filter((p) => !isLockedPiece(p.position)),
        (p) => `${p.position.x}-${p.position.y}`
      )

      if (offendingSubgraphs.length === 0 && offendingCorners.length === 0) {
        console.log('Piece ok')
        foundSolution = true
        break
      } else {
        console.log('Piece placement not ok, trying again..')
        // Otherwise revert the last addition and try again
        changeRandomPiece(board, pieces, offendingChangeable)
        setBoard([...board])
      }
    }

    if (foundSolution) {
      noSolutions.push(0)
      continue
    }

    // markPieces(offendingChangeable!)
    // console.log(offendingChangeable!)
    offendingChangeable!.forEach((offendingPiece) => {
      const { position: _position, ...removedPiece } = assertDefined(
        removePiece(board, offendingPiece.position)
      )
      pieces.push(removedPiece)
    })

    // If no solutions have been found for a while, start removing random other pieces
    const removeExtraCount =
      _.sum(noSolutions.get()) > 2 ? Math.min(1, filledPiecesCount(board)) : 0
    if (removeExtraCount > 0) {
      _.times(removeExtraCount).forEach(() => {
        const { position: _position, ...removedPiece } =
          removeRandomPiece(board)
        pieces.push(removedPiece)
      })
      console.log('EXTRA piece removed to unblock stalled iteration')
      noSolutions.clear()
    } else {
      noSolutions.push(1)
    }
  }

  setBoard(board)
}

export default Board
