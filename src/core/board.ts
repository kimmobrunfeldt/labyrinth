import _ from 'lodash'
import { createPieceBag } from 'src/core/pieces'
import {
  Board,
  ConnectedPieces,
  Direction,
  FilledBoard,
  NeighborPiece,
  NeighborPosition,
  NonEmptyArray,
  Piece,
  PieceOnBoard,
  Position,
  PushPosition,
  Rotation,
  Type,
  WalkableDirections,
} from 'src/gameTypes'
import { format, oppositeIndex } from 'src/utils/utils'

type FillBoardOptions = {
  maxFillPieces?: number
  pieceBag?: Piece[]
}

export function randomFillBoard(
  board: Board,
  {
    maxFillPieces = Infinity,
    pieceBag = createPieceBag(),
  }: FillBoardOptions = {}
) {
  let filled = 0
  if (emptyPiecesCount(board) !== pieceBag.length - 1) {
    throw new Error(
      `${emptyPiecesCount(
        board
      )} empty pieces on board but got piece bag with ${pieceBag.length} pieces`
    )
  }

  for (let y = 0; y < board.pieces.length; ++y) {
    for (let x = 0; x < board.pieces[0].length; ++x) {
      const piece = board.pieces[y][x]
      if (piece) {
        continue // leave already filled pieces as is
      }

      // We know there's enough pieces
      board.pieces[y][x] = toPositionPiece(assertDefined(pieceBag.pop()), {
        x,
        y,
      })

      filled += 1
      if (filled >= maxFillPieces) {
        return
      }
    }
  }
}

export function addPiece(board: Board, piece: Piece) {
  if (isFilled(board)) {
    throw new Error('Board already full')
  }

  for (let y = 0; y < board.pieces.length; ++y) {
    for (let x = 0; x < board.pieces[0].length; ++x) {
      if (!board.pieces[y][x]) {
        const placed: PieceOnBoard = toPositionPiece(piece, { x, y })

        board.pieces[y][x] = placed
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
  for (let y = 0; y < board.pieces.length; ++y) {
    for (let x = 0; x < board.pieces[0].length; ++x) {
      if (isPieceOnBoard(board.pieces[y][x]) && !isLockedPiece({ x, y })) {
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
): PieceOnBoard {
  const p = piece as PieceOnBoard
  p.position = position
  p.rotation = rotation
  p.players = []
  return p
}

export function toPiece(positionPiece: PieceOnBoard): Piece {
  const p = positionPiece as Piece
  delete p.position
  return p
}

export function removePiece(board: Board, pos: Position) {
  const piece = board.pieces[pos.y][pos.x]
  board.pieces[pos.y][pos.x] = null
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
  // Not performant, but there's just a short list of pieces to deal with
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
  return board.pieces.every((row) =>
    row.every((piece) => isPieceOnBoard(piece))
  )
}

export function emptyPiecesCount(board: Board): number {
  return _.sum(
    board.pieces.map((row) =>
      _.sum(row.map((piece) => (isPieceOnBoard(piece) ? 0 : 1)))
    )
  )
}

export function filledPiecesCount(board: Board): number {
  return _.sum(
    board.pieces.map((row) =>
      _.sum(
        row.map((piece) =>
          isPieceOnBoard(piece) && !isLockedPiece(piece.position) ? 1 : 0
        )
      )
    )
  )
}

export function isPieceOnBoard(piece: Piece | null): piece is PieceOnBoard {
  return !_.isUndefined(piece?.position)
}

export function getPieceAt(board: FilledBoard, pos: Position): PieceOnBoard {
  return board.pieces[pos.y][pos.x]
}

export function placePieceAt(
  board: FilledBoard,
  pos: Position,
  piece: Piece | PieceOnBoard
): PieceOnBoard {
  if (getPieceAt(board, pos)) {
    throw new Error(
      `Unable to place piece at position ${[
        pos.x,
        pos.y,
      ]}. Another piece already there.`
    )
  }

  if (isPieceOnBoard(piece)) {
    piece.position = pos
    board.pieces[pos.y][pos.x] = piece
  } else {
    board.pieces[pos.y][pos.x] = toPositionPiece(piece, pos, {
      rotation: piece.rotation,
    })
  }
  return board.pieces[pos.y][pos.x]
}

export function maybeGetPieceAt(
  board: Board,
  pos: Position
): PieceOnBoard | null {
  return board.pieces[pos.y][pos.x]
}

export function isLockedPiece(pos: Position): boolean {
  return (pos.x + 1) % 2 !== 0 && (pos.y + 1) % 2 !== 0
}

export function getNeighbors(
  board: Board,
  position: Position
): NeighborPiece[] {
  const positions: NeighborPosition[] = [
    getPositionInDirection(board, position, 'up'),
    getPositionInDirection(board, position, 'right'),
    getPositionInDirection(board, position, 'down'),
    getPositionInDirection(board, position, 'left'),
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
  direction: Direction,
  moves = 1
): PieceOnBoard | null {
  const newPos = getPositionInDirection(board, from, direction, { moves })
  if (!isOnBoard(board, newPos)) {
    return null
  }

  return maybeGetPieceAt(board, newPos)
}

export function getPositionInDirection(
  board: Board,
  pos: Position,
  direction: Direction,
  { moves = 1, throwOnError = false } = {}
): NeighborPosition {
  const { x, y } = pos
  switch (direction) {
    case 'up':
      if (throwOnError && y - moves < 0) {
        throw new Error(`Trying to move too much up to ${[x, y - moves]}`)
      }
      return { x, y: y - moves, direction: 'up' }
    case 'right':
      if (throwOnError && x + moves > board.pieces[0].length - 1) {
        throw new Error(`Trying to move too much right to ${[x + moves, y]}`)
      }
      return { x: x + moves, y, direction: 'right' }
    case 'down':
      if (throwOnError && y + moves > board.pieces.length - 1) {
        throw new Error(`Trying to move too much down to ${[x, y + moves]}`)
      }
      return { x, y: y + moves, direction: 'down' }
    case 'left':
      if (throwOnError && x - moves < 0) {
        throw new Error(`Trying to move too much left to ${[x - moves, y]}`)
      }
      return { x: x - moves, y, direction: 'left' }
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
  const width = board.pieces.length - 1
  const height = board.pieces[0].length - 1
  return x >= 0 && x <= width && y >= 0 && y <= height
}

export function findSubgraphsWithMoreThanXConnectedVertices(
  board: Board,
  maxEdges: number
): ConnectedPieces[] {
  const offending: PieceOnBoard[][] = []
  const allPieces: PieceOnBoard[] = _.flatten(board.pieces).filter(
    (p): p is PieceOnBoard => !_.isNull(p)
  )
  const visited = new Set<PieceOnBoard>()

  while (allPieces.length > 0) {
    const current = assertDefined(allPieces.pop()) // while loop checks for length
    if (visited.has(current)) {
      continue
    }

    const pieces = findConnected(board, new Set<PieceOnBoard>([current]))
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
  changeable: PieceOnBoard[]
) {
  const pieceToRemove = assertDefined(_.sample(changeable))
  const removed = assertDefined(removePiece(board, pieceToRemove.position))

  const newPiece = popRandom(assertNonEmpty(pieces))
  pieces.push(removed) // add back the previously removed
  board.pieces[removed.position.y][removed.position.x] = toPositionPiece(
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

export function randomFreePieceToRotate(subgraphs: ConnectedPieces[]) {
  const graph = assertDefined(_.sample(subgraphs))
  const freePieces = graph.filter((p) => !isLockedPiece(p.position))
  return _.sample(freePieces)
  return sampleNormalDistricution(freePieces)
}

export function rotatePieceOnBoard(
  board: Board,
  pos: Position,
  direction: -90 | 90 = +90
) {
  if (isLockedPiece(pos)) {
    throw new Error(`[${pos.x}, ${pos.y}] is locked piece`)
  }

  const piece = board.pieces[pos.y][pos.x]
  if (!piece) {
    throw new Error(`Unable to rotate: no piece at [${pos.x}, ${pos.y}]`)
  }

  piece.rotation = getNewRotation(piece.rotation, direction)
}

export function getNewRotation(current: Rotation, direction: -90 | 90 = +90) {
  let newRotation = (current + direction) as Rotation
  if (newRotation > 270) {
    newRotation = 0
  }
  if (newRotation < 0) {
    newRotation = 270
  }
  return newRotation
}

export function findConnected(
  board: Board,
  current: Set<PieceOnBoard>,
  visited: Set<PieceOnBoard> = new Set()
): PieceOnBoard[] {
  const nextBatch = new Set<PieceOnBoard>()

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
    findConnected(board, nextBatch, visited)
  }

  return [...visited]
}

export function isValidPlayerMove(
  board: FilledBoard,
  fromPos: Position,
  toPos: Position
): boolean {
  const piece = getPieceAt(board, fromPos)
  const connected = findConnected(board, new Set<PieceOnBoard>([piece]))
  return (
    connected.findIndex(
      (c) => c.position.x === toPos.x && c.position.y === toPos.y
    ) !== -1
  )
}

const pieceToOpenDirections: Record<
  Type,
  Record<Rotation, WalkableDirections>
> = {
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

/**
 * Returns the piece that fell off the other side
 */
export function pushWithPiece(
  board: FilledBoard,
  pushPos: PushPosition,
  pushPiece: Piece
): { piece: Piece; originalPiece: PieceOnBoard } {
  if (!isAllowedPushPosition(pushPos)) {
    throw new Error(`Unallowed push position: [${pushPos.x}, ${pushPos.y}]`)
  }

  const removePos = getPositionInDirection(
    board,
    pushPos,
    pushPos.direction,
    // XXX: Assumes square
    { moves: board.pieces.length - 1, throwOnError: true }
  )
  const pieceToRemove = getPieceAt(board, removePos)
  const extraPiece = toPiece(assertDefined(removePiece(board, removePos)))
  // Starting from the piece next to removed towards the push position, move pieces one
  // by one
  for (let i = 0; i < board.pieces.length - 1; ++i) {
    const fromPosition = getPositionInDirection(
      board,
      removePos,
      getOppositeDirection(pushPos.direction),
      { moves: i + 1, throwOnError: true }
    )
    const toPosition = getPositionInDirection(
      board,
      removePos,
      getOppositeDirection(pushPos.direction),
      { moves: i, throwOnError: true }
    )

    const fromPiece = getPieceAt(board, fromPosition)
    placePieceAt(board, toPosition, fromPiece) // add to new position
    removePiece(board, fromPosition) // remove old
  }
  placePieceAt(board, pushPos, pushPiece)

  return {
    piece: extraPiece,
    originalPiece: pieceToRemove,
  }
}

export const BOARD_PUSH_POSITIONS: readonly PushPosition[] = [
  // top
  { x: 1, y: 0, direction: 'down' },
  { x: 3, y: 0, direction: 'down' },
  { x: 5, y: 0, direction: 'down' },
  // right
  { x: 6, y: 1, direction: 'left' },
  { x: 6, y: 3, direction: 'left' },
  { x: 6, y: 5, direction: 'left' },
  // bottom
  { x: 5, y: 6, direction: 'up' },
  { x: 3, y: 6, direction: 'up' },
  { x: 1, y: 6, direction: 'up' },
  // left
  { x: 0, y: 5, direction: 'right' },
  { x: 0, y: 3, direction: 'right' },
  { x: 0, y: 1, direction: 'right' },
]

export function isAllowedPushPosition(pos: Position) {
  return (
    BOARD_PUSH_POSITIONS.findIndex(
      (item) => item.x === pos.x && item.y === pos.y
    ) !== -1
  )
}

export function getPushPosition(pos: Position): PushPosition {
  if (!isAllowedPushPosition(pos)) {
    throw new Error(`Unallowed push position: ${format.pos(pos)}`)
  }

  return assertDefined(
    BOARD_PUSH_POSITIONS.find((item) => item.x === pos.x && item.y === pos.y)
  )
}

export function getOppositePushPosition(
  boardWidth: number,
  pos: PushPosition
): PushPosition {
  switch (pos.direction) {
    case 'up':
    case 'down':
      return { ...pos, y: oppositeIndex(boardWidth, pos.y) }
    case 'right':
    case 'left':
      return { ...pos, x: oppositeIndex(boardWidth, pos.x) }
  }
}
