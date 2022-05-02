import { cartesianProduct } from 'combinatorial-generators'
import _ from 'lodash'
import {
  BotCreateOptions,
  BotImplementation,
  BOT_THINKING_DELAY,
} from 'src/core/bots/framework'
import { Client } from 'src/core/client'
import {
  assertDefined,
  BOARD_PUSH_POSITIONS,
  findConnected,
  getOppositePosition,
  getPieceAt,
  getPlayerPositionFromBoard,
  pushWithPiece,
} from 'src/core/server/board'
import * as t from 'src/gameTypes'

export const name = 'Boss bot'

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
      await new Promise((resolve) =>
        setTimeout(resolve, BOT_THINKING_DELAY / 2)
      )
      await push(getState(), client)

      await new Promise((resolve) =>
        setTimeout(resolve, BOT_THINKING_DELAY / 2)
      )
      await move(getState(), client)
    },
  }
}

async function push(state: t.ClientGameState, client: Client) {
  const combination = findNextPushCombination(state)
  await client.serverRpc.setExtraPieceRotation(combination.rotation)
  await client.serverRpc.push(combination.pushPosition)
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

function findNextPushCombination(state: t.ClientGameState): PushCombination {
  const current = stateToBoard(state)
  const combs = getPushCombinations(current)
  for (const futureBoard of getBoardsFromPushCombinations(current, combs)) {
    const review = reviewBoard(state, futureBoard)
    console.log('Review for board', review)
    if (review > 0) {
      return assertDefined(futureBoard.combination)
    }
  }

  return assertDefined(_.sample([...getPushCombinations(current)]))
}

const getRotations = (): t.Rotation[] => [0, 90, 180, 270]

function stateToBoard(state: t.ClientGameState): Board {
  return {
    filledBoard: state.board as unknown as t.FilledBoard,
    extraPiece: state.pieceBag[0],
    previousPushPosition: state.previousPushPosition,
    depth: 0,
    combination: state.previousPushPosition
      ? {
          pushPosition: state.previousPushPosition,
          rotation: getPieceAt(
            state.board as unknown as t.FilledBoard,
            state.previousPushPosition
          ).rotation,
          depth: -1,
        }
      : undefined,
  }
}

type PushCombination = {
  pushPosition: t.PushPosition
  rotation: t.Rotation
  depth: number // Recursion depth
}

/**
 * Get all possible push combinations that we can do, given the current game
 * state.
 */
function getPushCombinations(board: Board): Iterable<PushCombination> {
  return iterable.map(
    cartesianProduct(
      getAllowedPushPositions(board.filledBoard, board.previousPushPosition),
      getRotations()
    ),
    ([pushPos, rotation]) => ({
      pushPosition: pushPos,
      rotation,
      depth: board.depth,
    })
  )
}

type Board = {
  previous?: Board

  // Note: player move also encoded within board info
  filledBoard: t.FilledBoard
  extraPiece: t.Piece
  previousPushPosition?: t.PushPosition
  // Depth 0 means current board
  depth: number

  // How did we get here
  combination?: PushCombination
}

/**
 * Given a set of possible push combinations, get all new board states that the
 * pushes would lead to.
 */
function getBoardsFromPushCombinations(
  current: Board,
  combinations: Iterable<PushCombination>
): Iterable<Board> {
  return iterable.map(combinations, (c) => {
    const cloned = _.cloneDeep(current)
    const extra = pushWithPiece(cloned.filledBoard, c.pushPosition, {
      ...current.extraPiece,
      rotation: c.rotation,
    })
    return {
      filledBoard: cloned.filledBoard,
      extraPiece: extra.piece,
      previousPushPosition: c.pushPosition,
      depth: c.depth + 1,
      combination: c,
      previous: current,
    }
  })
}

/**
 * Takes a board and gives it an arbitrary numeric value based.
 * This value is used to detect the most fruitful branch out of all possible
 * options in the hypotethical moves decision tree.
 */
function reviewBoard(gameState: t.ClientGameState, board: Board): number {
  const myPos = getPlayerPositionFromBoard(board.filledBoard, gameState.me.id)
  const piece = getPieceAt(board.filledBoard, myPos)
  const connected = findConnected(
    board.filledBoard,
    new Set([assertDefined(piece)])
  )

  const trophiesAvailable = _.sumBy(connected, (piece) =>
    piece.trophy &&
    gameState.myCurrentCards.map((c) => c.trophy).includes(piece.trophy)
      ? 1
      : 0
  )
  return trophiesAvailable
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
