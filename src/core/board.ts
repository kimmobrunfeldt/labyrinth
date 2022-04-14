import _ from 'lodash'
import { createPieces } from 'src/core/pieces'
import {
  Board,
  Direction,
  FilledBoard,
  NeighborPiece,
  NeighborPosition,
  OpenDirections,
  Piece,
  Position,
  PositionPiece,
  Rotation,
  Type,
} from 'src/core/types'

type FillBoardOptions = {
  maxFillPieces?: number
  pieces?: Piece[]
}

export function fillBoard(
  board: Board,
  { maxFillPieces = Infinity, pieces = createPieces() }: FillBoardOptions = {}
): Board {
  let filled = 0
  if (emptyPiecesCount(board) !== pieces.length - 1) {
    throw new Error(
      `${emptyPiecesCount(board)} empty pieces on board but got ${
        pieces.length
      } pieces`
    )
  }

  return board.map((row, y) =>
    row.map((piece, x) => {
      if (piece || filled >= maxFillPieces) {
        return piece
      }

      filled += 1
      return {
        // We know there's enough pieces
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        ...pieces.pop()!,
        rotation: _.sample<Rotation>([0, 90, 180, 270]),
        position: { x, y },
      }
    })
  )
}

export function isFilled(board: Board): board is FilledBoard {
  return board.every((row) => row.every((piece) => !_.isNull(piece)))
}

export function emptyPiecesCount(board: Board): number {
  return _.sum(
    board.map((row) => _.sum(row.map((piece) => (_.isNull(piece) ? 1 : 0))))
  )
}

export function getPieceAt(board: FilledBoard, pos: Position): PositionPiece {
  return board[pos.y][pos.x]
}

export function getNeighbors(
  board: FilledBoard,
  position: Position
): NeighborPiece[] {
  const positions: NeighborPosition[] = [
    getPositionInDirection(position, 'up'),
    getPositionInDirection(position, 'right'),
    getPositionInDirection(position, 'down'),
    getPositionInDirection(position, 'left'),
  ]
  const validPositions = positions.filter((pos) => isOnBoard(board, pos))
  return validPositions.map((pos) => ({
    piece: getPieceAt(board, pos),
    direction: pos.direction,
  }))
}

export function getOppositeDirection(direction: Direction): Direction {
  switch (direction) {
    case 'up':
      return 'down'
    case 'right':
      return 'left'
    case 'down':
      return 'up'
    case 'left':
      return 'right'
  }
}

export function getPieceInDirection(
  board: FilledBoard,
  from: PositionPiece,
  direction: Direction
): PositionPiece | null {
  const newPos = getPositionInDirection(from.position, direction)
  if (!isOnBoard(board, newPos)) {
    return null
  }

  return getPieceAt(board, newPos)
}

export function getPositionInDirection(
  pos: Position,
  direction: Direction
): NeighborPosition {
  const { x, y } = pos
  switch (direction) {
    case 'up':
      return { x, y: y - 1, direction: 'up' } // up
    case 'right':
      return { x: x + 1, y, direction: 'right' } // right
    case 'down':
      return { x, y: y + 1, direction: 'down' } // down
    case 'left':
      return { x: x - 1, y, direction: 'left' } // left
  }
}

export function isValidMove(from: Piece, to: NeighborPiece): boolean {
  const openFrom = pieceToOpenDirections[from.type][from.rotation ?? 0]
  if (!openFrom[to.direction]) {
    // The current piece does not allow moving towards neighbor
    return false
  }

  const oppositeDirection = getOppositeDirection(to.direction)
  const openTo = pieceToOpenDirections[to.piece.type][to.piece.rotation ?? 0]
  // Check if it's possible to move from the neighbor to current piece
  return openTo[oppositeDirection]
}

export function isOnBoard(board: Board, { x, y }: Position): boolean {
  const width = board.length - 1
  const height = board[0].length - 1
  return x >= 0 && x <= width && y >= 0 && y <= height
}

export function fill(
  board: FilledBoard,
  visited: Set<PositionPiece>,
  current: Set<PositionPiece>
): PositionPiece[] {
  const nextBatch = new Set<PositionPiece>()

  current.forEach((p) => {
    visited.add(p)

    const connectedNeighbors = getNeighbors(board, p.position).filter((n) =>
      isValidMove(p, n)
    )
    connectedNeighbors.forEach((n) => {
      if (!visited.has(n.piece)) {
        nextBatch.add(n.piece)
      }
    })
  })

  if (nextBatch.size > 0) {
    fill(board, visited, nextBatch)
  }

  return [...visited]
}

const pieceToOpenDirections: Record<Type, Record<Rotation, OpenDirections>> = {
  corner: {
    0: { up: true, right: true, down: false, left: false },
    90: { up: false, right: true, down: true, left: false },
    180: { up: false, right: false, down: true, left: true },
    270: { up: true, right: false, down: false, left: true },
  },
  straight: {
    0: { up: true, right: false, down: true, left: false },
    90: { up: false, right: true, down: false, left: true },
    180: { up: true, right: false, down: true, left: false },
    270: { up: false, right: true, down: false, left: true },
  },
  't-shape': {
    0: { up: true, right: true, down: true, left: false },
    90: { up: false, right: true, down: true, left: true },
    180: { up: true, right: false, down: true, left: true },
    270: { up: true, right: true, down: false, left: true },
  },
}
