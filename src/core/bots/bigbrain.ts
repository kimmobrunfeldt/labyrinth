import { cartesianProduct } from 'combinatorial-generators'
import _ from 'lodash'
import { emitter } from 'src/components/Debug'
import { BotCreateOptions, BotImplementation } from 'src/core/bots/framework'
import { Client } from 'src/core/client'
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
import { format } from 'src/utils/utils'

export const name = 'Big Brain'

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
      const best = await findBestTurnDfs2(getState())
      const turnPath = getTurnPath(best.turn)
      const { topParent, depth } = getTopMostParent(best.turn)

      const moves = _.reverse(turnPath).map(
        (t) =>
          `push at ${format.pos(t.push!.pushPosition)} (${
            t.push!.rotation
          }), move to ${format.pos(t.moveTo!)}`
      )
      const pre = best.fallback ? 'fallback solution' : 'optimal solution'
      await client.serverRpc.sendMessage(
        `${pre} at depth ${depth}: ${moves.join(' -> ')}`
      )

      await client.serverRpc.setExtraPieceRotation(
        assertDefined(topParent.push).rotation
      )
      await new Promise((resolve) => setTimeout(resolve, 1000))
      await client.serverRpc.setPushPositionHover(
        assertDefined(topParent.push).pushPosition
      )
      await new Promise((resolve) => setTimeout(resolve, 600))
      await client.serverRpc.push(assertDefined(topParent.push).pushPosition)
      await client.serverRpc.move(assertDefined(topParent.moveTo))
    },
  }
}

async function move(gameState: t.ClientGameState, client: Client) {
  if (!gameState.myPosition) {
    throw new Error('My position not found from state')
  }

  const currentPos = gameState.myPosition
  const piece = getPieceAt(
    gameState.board as unknown as t.FilledBoard,
    currentPos
  )
  const connected = _.shuffle(
    findConnected(
      gameState.board as unknown as t.Board,
      new Set([assertDefined(piece)])
    )
  )

  const piecesWithMyTrophies = connected.filter(
    (piece) =>
      piece.trophy &&
      gameState.myCurrentCards.map((c) => c.trophy).includes(piece.trophy)
  )

  if (piecesWithMyTrophies.length > 0) {
    await client.serverRpc.move(piecesWithMyTrophies[0].position)
    return
  }

  // Take another pos by random
  const newPos =
    connected.find(
      (p) => p.position.x !== currentPos.x && p.position.y !== currentPos.y
    )?.position ?? currentPos
  await client.serverRpc.move(newPos)
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
  const turns: Turn[] = [turn]
  while (current.previousTurn) {
    current = current.previousTurn
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

export async function findBestTurnDfs2(
  state: t.ClientGameState
): Promise<{ turn: Turn; fallback: boolean }> {
  const startTime = new Date().getTime()
  const visited: Board[] = []
  const stack: Turn[] = [stateToCurrentTurn(state)]
  let fallbackTurn: Turn = stack[0]

  while (stack.length > 0) {
    await new Promise((resolve) => setTimeout(resolve, 0))
    const turn = stack.pop()! // just checked in while loop
    fallbackTurn = turn

    // Give 5 seconds time to find a solution
    if (new Date().getTime() - startTime > 10 * 1000) {
      break
    }

    if (hasBeenVisited(state.me.id, visited, turn.boardAfterMove)) {
      continue
    }
    visited.push(turn.boardAfterMove)
    emitter.dispatch('board', turn.boardAfterMove)

    const review = reviewBoard(state, turn.boardAfterMove)
    if (review > 0) {
      return { turn, fallback: false }
    }

    if (turn.depth >= 2) {
      continue
    }

    const turnCombinations = [
      ...getTurnCombinations(state.me.id, turn.boardAfterMove),
    ]
    for (const turnCombination of turnCombinations) {
      for (const move of turnCombination.movePositions) {
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
        stack.push(newTurn)
      }
    }
  }

  return {
    turn: _.sample(stack) ?? fallbackTurn,
    fallback: true,
  }
}

export async function findBestTurnDfs(
  state: t.ClientGameState,
  turn: Turn = stateToCurrentTurn(state),
  visited: Board[] = []
): Promise<Turn | undefined> {
  visited.push(turn.boardAfterMove)
  const turnCombinations = [
    ...getTurnCombinations(state.me.id, turn.boardAfterMove),
  ]

  for (const turnCombination of turnCombinations) {
    console.log('move positions', turnCombination.movePositions.length)
    for (const move of turnCombination.movePositions) {
      await new Promise((resolve) => setTimeout(resolve, 50))
      const boardAfterMove = _.cloneDeep(turnCombination.boardAfterPush)
      emitter.dispatch('board', boardAfterMove)
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

      const review = reviewBoard(state, newTurn.boardAfterMove)
      console.log('review', review, newTurn)
      if (review > 0) {
        return newTurn
      }

      if (
        !hasBeenVisited(state.me.id, visited, boardAfterMove) &&
        newTurn.depth <= 4
      ) {
        return findBestTurnDfs(state, newTurn, visited)
      }
    }
  }

  // No solution was found
}

export async function findBestTurn(
  state: t.ClientGameState,
  turns: Turn[] = [stateToCurrentTurn(state)],
  visited: Board[] = []
): Promise<Turn> {
  const nextBatch: Turn[] = []

  console.log('batch of', turns.length, 'turns')
  for (const turn of turns) {
    const turnCombinations = [
      ...getTurnCombinations(state.me.id, turn.boardAfterMove),
    ]
    console.log('new turn combinations', turnCombinations.length)
    for (const turnCombination of turnCombinations) {
      console.log('move positions', turnCombination.movePositions.length)
      for (const move of turnCombination.movePositions) {
        await new Promise((resolve) => setTimeout(resolve, 1000))
        const boardAfterMove = _.cloneDeep(turnCombination.boardAfterPush)
        emitter.dispatch('board', boardAfterMove)
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

        //console.time('hasbeenvisited')
        if (!hasBeenVisited(state.me.id, visited, boardAfterMove)) {
          visited.push(newTurn.boardAfterMove)
          nextBatch.push(newTurn)
        }
        //console.timeEnd('hasbeenvisited')
        //console.log('visited', visited.length)
      }
    }
  }

  if (nextBatch.length === 0) {
    return turns[0]
  }

  for (const newTurn of nextBatch) {
    const review = reviewBoard(state, newTurn.boardAfterMove)
    console.log('review', review, newTurn)
    if (review > 0) {
      return newTurn
    }
  }
  console.log('nextbatch')

  // If no turn was found at this depth, recurse more
  return findBestTurn(state, nextBatch, visited)
}

function hasBeenVisited(
  myPlayerId: string,
  visited: Board[],
  candidate: Board
): boolean {
  return visited.some((board) => {
    const myPos1 = getPlayerPositionFromBoard(board.filledBoard, myPlayerId)
    const myPos2 = getPlayerPositionFromBoard(candidate.filledBoard, myPlayerId)
    return isSamePosition(myPos1, myPos2) && isSameBoard(board, candidate)
  })
}

function isSameBoard(board1: Board, board2: Board): boolean {
  if (board1.extraPiece.id !== board2.extraPiece.id) {
    return false
  }

  return board1.filledBoard.pieces.every((b1Row, y) => {
    return b1Row.every((b1Piece, x) => {
      const b2Piece = board2.filledBoard.pieces[y][x]
      return b1Piece.rotation === b2Piece.rotation && b1Piece.id === b2Piece.id
    })
  })
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
      board.filledBoard as unknown as t.FilledBoard,
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
  const myPos = getPlayerPositionFromBoard(board.filledBoard, gameState.me.id)
  const piece = getPieceAt(board.filledBoard, myPos)

  const value =
    piece.trophy &&
    gameState.myCurrentCards.map((c) => c.trophy).includes(piece.trophy)
      ? 1
      : 0

  return value
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
