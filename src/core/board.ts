import _ from 'lodash'
import { createPieces } from 'src/core/pieces'
import {
  Board,
  Direction,
  FilledBoard,
  NeighborPiece,
  NeighborPosition,
  NonEmptyArray,
  OpenDirections,
  Piece,
  Position,
  PositionPiece,
  Rotation,
  Subgraph,
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
        ...assertDefined(pieces.pop()),
        rotation: assertDefined(_.sample<Rotation>([0, 90, 180, 270])),
        position: { x, y },
      }
    })
  )
}

export function addPiece(board: Board, piece: Piece) {
  if (isFilled(board)) {
    throw new Error('Board already full')
  }

  for (let y = 0; y < board.length; ++y) {
    for (let x = 0; x < board[0].length; ++x) {
      if (!board[y][x]) {
        const placed: PositionPiece = toPositionPiece(piece, { x, y })

        board[y][x] = placed
        return placed
      }
    }
  }

  throw new Error('never')
}

export function removeRandomPiece(board: Board) {
  const filledCount = filledPiecesCount(board)
  const randomIndex = Math.floor(Math.random() * filledCount)
  let i = 0
  for (let y = 0; y < board.length; ++y) {
    for (let x = 0; x < board[0].length; ++x) {
      if (!_.isNull(board[y][x]) && !isLockedPiece({ x, y })) {
        if (i === randomIndex) {
          return assertDefined(removePiece(board, { x, y }))
        }

        ++i
      }
    }
  }

  throw new Error('never')
}

export function toPositionPiece(
  piece: Piece,
  position: Position,
  { rotation = assertDefined(_.sample<Rotation>([0, 90, 180, 270])) } = {}
): PositionPiece {
  return {
    ...piece,
    position,
    rotation,
  }
}

export function removePiece(board: Board, pos: Position) {
  const piece = board[pos.y][pos.x]
  board[pos.y][pos.x] = null
  return piece
}

export function popRandom<T>(arr: NonEmptyArray<T>): T {
  const randomIndex = Math.floor(Math.random() * arr.length)
  return arr.splice(randomIndex, 1)[0]
}

export function popIndex<T>(arr: NonEmptyArray<T>, index: number): T {
  return arr.splice(index, 1)[0]
}

export function getWeightedRandomPieceIndex(arr: NonEmptyArray<Piece>): number {
  // Must be integers
  const weights: Record<Type, number> = {
    straight: 5,
    't-shape': 90,
    corner: 5,
  }
  const ranges = arr.reduce((memo, piece, index) => {
    const prevMax = memo[index - 1]?.max ?? -1
    memo.push({
      min: prevMax + 1,
      max: prevMax + 1 + weights[piece.type],
      piece,
      index,
    })
    return memo
  }, [] as { min: number; max: number; piece: Piece; index: number }[])
  const randomInt = Math.floor(
    Math.random() * assertDefined(_.last(ranges)).max
  )
  return assertDefined(
    ranges.find((range) => randomInt >= range.min && randomInt <= range.max)
  ).index
}

export function isFilled(board: Board): board is FilledBoard {
  return board.every((row) => row.every((piece) => !_.isNull(piece)))
}

export function emptyPiecesCount(board: Board): number {
  return _.sum(
    board.map((row) => _.sum(row.map((piece) => (_.isNull(piece) ? 1 : 0))))
  )
}

export function filledPiecesCount(board: Board): number {
  return _.sum(
    board.map((row) =>
      _.sum(
        row.map((piece) =>
          !_.isNull(piece) && !isLockedPiece(piece.position) ? 1 : 0
        )
      )
    )
  )
}

export function getPieceAt(board: FilledBoard, pos: Position): PositionPiece {
  return board[pos.y][pos.x]
}

export function maybeGetPieceAt(
  board: Board,
  pos: Position
): PositionPiece | null {
  return board[pos.y][pos.x]
}

export function isLockedPiece(pos: Position): boolean {
  return (pos.x + 1) % 2 !== 0 && (pos.y + 1) % 2 !== 0
}

export function getNeighbors(
  board: Board,
  position: Position
): NeighborPiece[] {
  const positions: NeighborPosition[] = [
    getPositionInDirection(position, 'up'),
    getPositionInDirection(position, 'right'),
    getPositionInDirection(position, 'down'),
    getPositionInDirection(position, 'left'),
  ]
  const validPositions = positions.filter((pos) => isOnBoard(board, pos))
  return validPositions
    .map((pos) => ({
      piece: maybeGetPieceAt(board, pos),
      direction: pos.direction,
    }))
    .filter((p): p is NeighborPiece => !_.isNull(p.piece))
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
  board: Board,
  from: Position,
  direction: Direction
): PositionPiece | null {
  const newPos = getPositionInDirection(from, direction)
  if (!isOnBoard(board, newPos)) {
    return null
  }

  return maybeGetPieceAt(board, newPos)
}

export function getPositionInDirection(
  pos: Position,
  direction: Direction
): NeighborPosition {
  const { x, y } = pos
  switch (direction) {
    case 'up':
      return { x, y: y - 1, direction: 'up' }
    case 'right':
      return { x: x + 1, y, direction: 'right' }
    case 'down':
      return { x, y: y + 1, direction: 'down' }
    case 'left':
      return { x: x - 1, y, direction: 'left' }
  }
}

export function isValidMove(from: Piece, to: NeighborPiece): boolean {
  const openFrom = pieceToOpenDirections[from.type][from.rotation]
  if (!openFrom[to.direction]) {
    // The current piece does not allow moving towards neighbor
    return false
  }

  const oppositeDirection = getOppositeDirection(to.direction)
  const openTo = pieceToOpenDirections[to.piece.type][to.piece.rotation]
  // Check if it's possible to move from the neighbor to current piece
  return openTo[oppositeDirection]
}

export function isOnBoard(board: Board, { x, y }: Position): boolean {
  const width = board.length - 1
  const height = board[0].length - 1
  return x >= 0 && x <= width && y >= 0 && y <= height
}

export function findSubgraphsWithMoreThanXConnectedVertices(
  board: Board,
  maxEdges: number
): Subgraph[] {
  const offending: PositionPiece[][] = []
  const allPieces: PositionPiece[] = _.flatten(board).filter(
    (p): p is PositionPiece => !_.isNull(p)
  )
  const visited = new Set<PositionPiece>()

  while (allPieces.length > 0) {
    const current = assertDefined(allPieces.pop()) // while loop checks for length
    if (visited.has(current)) {
      continue
    }

    const pieces = fill(board, new Set<PositionPiece>([current]))
    if (pieces.length > maxEdges) {
      offending.push(pieces)
    }
    pieces.forEach((p) => visited.add(p))
  }
  return offending
}

/**
 * Returns an array of "bad" pieces nearby corners. Corner pieces should be completely
 * unconnected to any other pieces in the desired start state.
 * This is desireable because no player gets an initial route anywhere.
 */
export function getConnectedCornerNeighbors(board: Board) {
  const positions: Position[] = [
    { x: 0, y: 0 }, // top left
    { x: 6, y: 0 }, // top right
    { x: 6, y: 6 }, // bottom right
    { x: 0, y: 6 }, // bottom left
  ]
  return positions.flatMap((pos) => {
    // We know the corner pieces are pre-filled to board
    const cornerPiece = assertDefined(maybeGetPieceAt(board, pos))
    const connectedNeighbors = getNeighbors(board, pos).filter((n) =>
      isValidMove(cornerPiece, n)
    )
    return connectedNeighbors.map(
      // We know the piece exists
      (np) => assertDefined(getPieceInDirection(board, pos, np.direction))
    )
  })
}

export function assertDefined<T>(val: T | undefined | null): T {
  if (_.isNil(val)) {
    throw new Error('Unexpected nil value')
  }
  return val
}

export function changeRandomPiece(
  board: Board,
  pieces: Piece[],
  changeable: PositionPiece[]
) {
  const pieceToRemove = assertDefined(_.sample(changeable))
  const removed = assertDefined(removePiece(board, pieceToRemove.position))

  const newPiece = popRandom(assertNonEmpty(pieces))
  pieces.push(removed) // add back the previously removed
  board[removed.position.y][removed.position.x] = toPositionPiece(
    newPiece,
    removed.position
  )
}

function isNonEmpty<T>(arr: T[]): arr is NonEmptyArray<T> {
  return arr.length > 0
}

function assertNonEmpty<T>(arr: T[]): NonEmptyArray<T> {
  if (!isNonEmpty(arr)) {
    throw new Error(`Expected non-empty array: ${arr}`)
  }
  return arr as NonEmptyArray<T>
}

function randomNormalDistribution(): number {
  let u = 0,
    v = 0
  while (u === 0) u = Math.random() // Converting [0,1) to (0,1)
  while (v === 0) v = Math.random()
  let num = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v)
  num = num / 10.0 + 0.5 // Translate to 0 -> 1
  if (num > 1 || num < 0) return randomNormalDistribution() // resample between 0 and 1
  return num
}

function sampleNormalDistricution<T>(arr: T[]): T | undefined {
  return arr[Math.floor(randomNormalDistribution() * arr.length)]
}

export function randomFreePieceToRotate(subgraphs: Subgraph[]) {
  const graph = assertDefined(_.sample(subgraphs))
  const freePieces = graph.filter((p) => !isLockedPiece(p.position))
  return _.sample(freePieces)
  return sampleNormalDistricution(freePieces)
}

export function rotatePiece(board: Board, pos: Position) {
  if (isLockedPiece(pos)) {
    throw new Error(`[${pos.y}, ${pos.x}] is locked piece`)
  }

  const piece = board[pos.y][pos.x]
  if (!piece) {
    throw new Error(`Unable to rotate: no piece at [${pos.y}, ${pos.x}]`)
  }

  const newRotation =
    piece.rotation === 270 ? 0 : ((piece.rotation + 90) as Rotation)
  piece.rotation = newRotation
}

export function fill(
  board: Board,
  current: Set<PositionPiece>,
  visited: Set<PositionPiece> = new Set()
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
    fill(board, nextBatch, visited)
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

export function createRingBuffer<T>({ max }: { max: number }) {
  let buffer: T[] = []

  function push(item: T) {
    buffer.push(item)
    if (buffer.length > max) {
      buffer.shift()
    }
  }

  function get(): T[] {
    return buffer
  }

  function clear() {
    buffer = []
  }

  return { push, get, clear }
}
