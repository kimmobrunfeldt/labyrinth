import { Queue } from '@datastructures-js/queue'
import { cartesianProduct } from 'combinatorial-generators'
import _ from 'lodash'
import {
  BotCreateOptions,
  BotImplementation,
  BOT_THINKING_DELAY,
} from 'src/core/bots/framework'
import {
  assertDefined,
  BOARD_PUSH_POSITIONS,
  findConnected,
  getOppositePosition,
  getPieceAt,
  getPlayerPositionFromBoard,
  movePlayerPosition,
  pushWithPiece,
} from 'src/core/server/board'
import * as t from 'src/gameTypes'
import { format, sleep } from 'src/utils/utils'

export const name = 'Saboteur'

/**
 * Warning! You must use `client` as is, because it's a Proxy object for
 * reconnect purposes. Don't take any properties out of it, it will break.
 *
 * Do not:
 *
 *   // Bad
 *   const { serverRpc } = client
 *
 *   // Bad
 *   const getMyPosition = client.serverRpc.getMyPosition()
 *
 * Whatever you need to access within client, always use the full property path:
 *
 *   client.serverRpc.getMyPosition()
 *
 * @returns Promise so that the bot creation can do something async if needed.
 */
export async function create({
  logger,
  client,
}: BotCreateOptions): Promise<BotImplementation> {
  return {
    async onMyTurn(getState) {
      const best = await findBestTurn(getState())
      const turnPath = getTurnPath(best.turn)
      const { topParent } = getTopMostParent(best.turn)

      const turns = _.reverse(turnPath).map(
        (t) =>
          `push at ${format.pos(t.push!.pushPosition)} (${
            t.push!.rotation
          }), move to ${format.pos(t.moveTo!)}`
      )
      const pre = best.fallback ? 'solution' : 'solution'
      await client.serverRpc.sendMessage(
        `${pre} with ${turns.length} turns: ${turns.join(' -> ')}`
      )

      await sleep(0.3 * BOT_THINKING_DELAY)
      await client.serverRpc.setPushPositionHover(
        assertDefined(topParent.push).pushPosition
      )

      await sleep(0.2 * BOT_THINKING_DELAY)
      await client.serverRpc.setExtraPieceRotation(
        assertDefined(topParent.push).rotation
      )
      await sleep(0.3 * BOT_THINKING_DELAY)
      await client.serverRpc.push(assertDefined(topParent.push).pushPosition)
      await sleep(0.2 * BOT_THINKING_DELAY)
      await client.serverRpc.move(assertDefined(topParent.moveTo))
    },
  }
}

function getTopMostParent(turn: Turn): { topParent: Turn; depth: number } {
  let current = turn
  let steps = 0
  while (current.previousTurn) {
    current = current.previousTurn
    steps++
  }
  return {
    topParent: current,
    depth: steps,
  }
}

function getTurnPath(turn: Turn): Turn[] {
  let current = turn
  console.log('current', current)
  const turns: Turn[] = [turn]
  while (current.previousTurn) {
    current = current.previousTurn
    console.log('loop, current', current)
    turns.push(current)
  }
  return turns
}

function getAllowedPushPositions(
  board: t.FilledBoard,
  previousPushPosition?: t.PushPosition
): readonly t.PushPosition[] {
  const blockedPushPosition = previousPushPosition
    ? getOppositePosition(board.pieces.length, previousPushPosition)
    : undefined

  if (!blockedPushPosition) {
    return BOARD_PUSH_POSITIONS
  }

  return BOARD_PUSH_POSITIONS.filter(
    (pushPos) =>
      pushPos.x !== blockedPushPosition.x && pushPos.y !== blockedPushPosition.y
  )
}

export function getAdjacentNodes(state: t.ClientGameState, turn: Turn) {
  const turnCombinations = getTurnCombinations(state.me.id, turn.boardAfterMove)
  return [...turnCombinations].flatMap((turnCombination) => {
    return turnCombination.movePositions.map((move) => {
      const boardAfterMove = _.cloneDeep(turnCombination.boardAfterPush)
      movePlayerPosition(boardAfterMove.filledBoard, state.me.id, move)

      const newTurn: Turn = {
        // If the prev turn doesn't have a push -> it's the starting point
        // In that case let's not mark it as the previous push
        previousTurn: turn.push ? turn : undefined,
        push: turnCombination.push,
        moveTo: move,
        boardAfterMove,
        depth: turn.depth + 1,
      }
      return newTurn
    })
  })
}

export async function findBestTurn(state: t.ClientGameState) {
  const startTime = new Date().getTime()
  const startTurn = stateToCurrentTurn(state)
  const Q = new Queue<Turn>([startTurn])
  const visited: Board[] = [startTurn.boardAfterMove]

  const reviewSoFar = 0
  let bestSoFar = assertDefined(_.sample(getAdjacentNodes(state, startTurn)))
  while (!Q.isEmpty()) {
    await sleep(0)
    if (new Date().getTime() - startTime > 3000) {
      break
    }

    const v = Q.dequeue()

    const neighbors = getAdjacentNodes(state, v)
    for (const neighbor of neighbors) {
      const review = reviewBoard(state, neighbor.boardAfterMove)
      if (review > reviewSoFar) {
        bestSoFar = neighbor
      }

      const hasVisited = hasBeenVisited(
        state.me.id,
        visited,
        neighbor.boardAfterMove
      )
      if (!hasVisited && neighbor.depth < 1) {
        Q.enqueue(neighbor)
        visited.push(neighbor.boardAfterMove)
      }
    }
  }

  return {
    turn: bestSoFar,
    fallback: false,
  }
}

function hasBeenVisited(
  myPlayerId: string,
  visited: Board[],
  candidate: Board
): boolean {
  for (let i = 0; i < visited.length; ++i) {
    const board = visited[i]
    const myPos1 = getPlayerPositionFromBoard(board.filledBoard, myPlayerId)
    const myPos2 = getPlayerPositionFromBoard(candidate.filledBoard, myPlayerId)
    if (isSamePosition(myPos1, myPos2)) {
      return true
    }
    if (isSameBoard(board, candidate)) {
      return true
    }
  }
  return false
}

function isSameBoard(board1: Board, board2: Board): boolean {
  if (board1.extraPiece.id !== board2.extraPiece.id) {
    return false
  }

  for (let y = 0; y < board1.filledBoard.pieces.length; ++y) {
    const b1Row = board1.filledBoard.pieces[y]
    for (let x = 0; x < b1Row.length; ++x) {
      const b1Piece = board1.filledBoard.pieces[y][x]
      const b2Piece = board2.filledBoard.pieces[y][x]
      if (b1Piece.rotation !== b2Piece.rotation || b1Piece.id !== b2Piece.id) {
        return false
      }
    }
  }

  return true
}

const isSamePosition = (p1: t.Position, p2: t.Position) =>
  p1.x === p2.x && p1.y === p2.y

const getRotations = (): t.Rotation[] => [0, 90, 180, 270]

function stateToBoard(state: t.ClientGameState): Board {
  return {
    filledBoard: state.board as unknown as t.FilledBoard,
    extraPiece: state.pieceBag[0],
    previousPushPosition: state.previousPushPosition,
  }
}

function stateToCurrentTurn(state: t.ClientGameState): Turn {
  return {
    previousTurn: undefined,
    push: undefined,
    moveTo: undefined,
    boardAfterMove: stateToBoard(state),
    depth: 0,
  }
}

type Board = {
  // Note: player move also encoded within board info
  filledBoard: t.FilledBoard
  extraPiece: t.Piece
  previousPushPosition?: t.PushPosition
}

type Push = {
  rotation: t.Rotation
  pushPosition: t.PushPosition
}

// Represents a single turn with specific push (rotation + push pos) AND move
type Turn = {
  previousTurn?: Turn
  push?: Push
  moveTo?: t.Position
  boardAfterMove: Board
  depth: number // Recursion depth
}

// Represents the move possibilities after a single push (rotation + push pos)
type TurnCombination = {
  push: Push
  boardAfterPush: Board
  movePositions: t.Position[]
}

/**
 * Get all possible push combinations that we can do, given the current game
 * state.
 */
function getPushCombinations(board: Board): Iterable<Push> {
  return iterable.map(
    cartesianProduct(
      getAllowedPushPositions(board.filledBoard, board.previousPushPosition),
      getRotations()
    ),
    ([pushPos, rotation]) => ({
      pushPosition: pushPos,
      rotation,
    })
  )
}

function getTurnCombinations(
  myPlayerId: string,
  board: Board
): Iterable<TurnCombination> {
  return iterable.map(getPushCombinations(board), (push) => {
    const newBoard = getBoardFromPush(board, push)
    const myPos = getPlayerPositionFromBoard(newBoard.filledBoard, myPlayerId)
    const piece = getPieceAt(
      newBoard.filledBoard as unknown as t.FilledBoard,
      myPos
    )
    const connected = findConnected(
      newBoard.filledBoard,
      new Set([assertDefined(piece)])
    )

    return {
      push,
      boardAfterPush: newBoard,
      movePositions: connected.map((c) => c.position),
    }
  })
}

function getBoardFromPush(current: Board, push: Push): Board {
  const cloned = _.cloneDeep(current)
  const extra = pushWithPiece(cloned.filledBoard, push.pushPosition, {
    ...current.extraPiece,
    rotation: push.rotation,
  })
  // Transfer players to the other edge
  const addedPiece = getPieceAt(cloned.filledBoard, push.pushPosition)
  addedPiece.players = extra.originalPiece.players
  return {
    filledBoard: cloned.filledBoard,
    extraPiece: extra.piece,
    previousPushPosition: push.pushPosition,
  }
}

/**
 * Takes a board and gives it an arbitrary numeric value.
 * This value is used to detect the most fruitful branch out of all possible
 * options in the hypotethical moves decision tree.
 */
function reviewBoard(gameState: t.ClientGameState, board: Board): number {
  const otherPlayerIds = gameState.players
    .map((p) => p.id)
    .filter((id) => id !== gameState.me.id)
  const myPos = getPlayerPositionFromBoard(board.filledBoard, gameState.me.id)
  const piece = getPieceAt(board.filledBoard, myPos)

  let score = 0
  if (piece.players.length > 1) {
    // Prefer harassing someone
    score += 10
  }

  const playerConnections = otherPlayerIds
    .map((id) => getPlayerPositionFromBoard(board.filledBoard, id))
    .map((pos) => {
      const piece = getPieceAt(board.filledBoard, pos)
      const connected = findConnected(board.filledBoard, new Set([piece]))
      return connected.length
    })

  for (let i = 0; i < playerConnections.length; ++i) {
    if (playerConnections[i] === 1) {
      // If we can trap someone, let's do it
      return 10000
    }
  }

  return 1000 + score - _.sum(playerConnections)
}

// Relevant: https://github.com/tc39/proposal-iterator-helpers
const iterable = {
  map: function* mapIter<T, U>(
    iterable: Iterable<T>,
    cb: (val: T) => U
  ): Iterable<U> {
    for (const val of iterable) {
      yield cb(val)
    }
  },
}
