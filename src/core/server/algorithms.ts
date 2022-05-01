import _ from 'lodash'
import {
  addPiece,
  assertDefined,
  changeRandomPiece,
  createRingBuffer,
  emptyPiecesCount,
  filledPiecesCount,
  findSubgraphsWithMoreThanXConnectedVertices,
  getConnectedCornerNeighbors,
  getWeightedRandomPieceIndex,
  isLockedPiece,
  isPieceOnBoard,
  popIndex,
  randomFillBoard,
  randomFreePieceToRotate,
  removePiece,
  removeRandomPiece,
} from 'src/core/server/board'
import {
  createInitialBoardPieces,
  createPieceBag,
} from 'src/core/server/pieces'
import * as t from 'src/gameTypes'
import {
  ConnectedPieces,
  FilledBoard,
  NonEmptyArray,
  Piece,
  PieceOnBoard,
} from 'src/gameTypes'
import { Logger } from 'src/utils/utils'

export function random({ logger }: { logger: Logger }) {
  while (true) {
    const pieces = createPieceBag()
    const board = {
      pieces: createInitialBoardPieces() as FilledBoard['pieces'], // filled below
      playerPositions: {},
    }
    randomFillBoard(board, {
      pieceBag: pieces,
    })
    let tries = 0

    while (true) {
      const offendingSubgraphs = findSubgraphsWithMoreThanXConnectedVertices(
        board,
        4
      )
      const offendingCorners = getConnectedCornerNeighbors(board)
      const offending = _.uniqBy(
        _.flatten(offendingSubgraphs)
          .concat(offendingCorners)
          .filter((p) => !isLockedPiece(p.position)),
        (p) => `${p.position.x}-${p.position.y}`
      )
      if (offending.length === 0) {
        return {
          board,
          pieceBag: pieces,
        }
      }

      // When there are offending subgraphs, we know they contain pieces
      const random = assertDefined(randomFreePieceToRotate([offending]))
      changeRandomPiece(board, pieces, [random])

      // If no solutions have been found for a while, start removing random other pieces
      if (tries > 200) {
        const candidates = _.flatten(board.pieces)
          .filter((p) => isPieceOnBoard(p) && !isLockedPiece(p.position))
          .filter((p) => {
            const found = _.flatten(offending).findIndex(
              (o) =>
                o.position.x === p.position.x && o.position.y === p.position.y
            )
            return found === -1
          })

        if (candidates.length > 0) {
          changeRandomPiece(board, pieces, candidates)
          tries = 0
          continue
        }
      }

      tries++
    }
  }
}

export function systematicRandom({
  logger,
  level,
}: {
  logger: Logger
  level: t.ShuffleLevel
}) {
  const pieces = createPieceBag()
  const board = {
    pieces: createInitialBoardPieces() as FilledBoard['pieces'], // filled below
  }

  const maxBuffer = 10
  const noSolutions = createRingBuffer<number>({ max: maxBuffer })

  while (emptyPiecesCount(board) > 0) {
    // Since the board has empty slots -> pieces array must be non-empty
    // as there will always be one piece left even after complete filling
    const index = getWeightedRandomPieceIndex(pieces as NonEmptyArray<Piece>)
    const piece = popIndex(pieces as NonEmptyArray<Piece>, index)
    addPiece(board, piece)

    let offendingSubgraphs: ConnectedPieces[]
    let offendingCorners: PieceOnBoard[]
    let offendingChangeable: PieceOnBoard[]
    let foundSolution = false

    for (let tries = 0; tries < 50; ++tries) {
      offendingSubgraphs = findSubgraphsWithMoreThanXConnectedVertices(
        board,
        levelToConnectedCount(level)
      )
      offendingCorners = getConnectedCornerNeighbors(board)
      offendingChangeable = _.uniqBy(
        _.flatten(offendingSubgraphs)
          .concat(offendingCorners)
          .filter((p) => !isLockedPiece(p.position)),
        (p) => `${p.position.x}-${p.position.y}`
      )

      if (offendingSubgraphs.length === 0 && offendingCorners.length === 0) {
        foundSolution = true
        break
      } else {
        // Otherwise revert the last addition and try again
        changeRandomPiece(board, pieces, offendingChangeable)
      }
    }

    if (foundSolution) {
      noSolutions.push(0)
      continue
    }

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
      logger.debug('Extra piece removed to unblock stalled shuffle iteration')
      noSolutions.clear()
    } else {
      noSolutions.push(1)
    }
  }

  return {
    board,
    pieceBag: pieces,
  }
}

const levelToConnectedCount = (l: t.ShuffleLevel) => {
  switch (l) {
    case 'easy':
      return 7
    case 'medium':
      return 4
    case 'hard':
      return 3
    case 'perfect':
      return 2
  }
}
