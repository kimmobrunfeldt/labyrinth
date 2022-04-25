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
} from 'src/core/board'
import { createInitialBoardPieces, createPieceBag } from 'src/core/pieces'
import {
  Board,
  ConnectedPieces,
  FilledBoard,
  NonEmptyArray,
  Piece,
  PieceOnBoard,
} from 'src/gameTypes'

/**
 * Allows algorithms to present some middle state via UI
 */
export type UiForAlgorithm = {
  setBoard: React.Dispatch<React.SetStateAction<Board>>
  setBoardUi: React.Dispatch<
    React.SetStateAction<
      {
        opacity: number
      }[][]
    >
  >
  markPieces: (pieces: PieceOnBoard[]) => void
}

export async function random({ setBoard }: UiForAlgorithm) {
  while (true) {
    console.log('loop')
    const pieces = createPieceBag()
    const board = {
      pieces: createInitialBoardPieces() as FilledBoard['pieces'], // filled below
      playerPositions: {},
    }
    randomFillBoard(board, {
      pieceBag: pieces,
    })
    let tries = 0

    for (let i = 0; i < 10000; ++i) {
      setBoard(board)

      const offendingSubgraphs = findSubgraphsWithMoreThanXConnectedVertices(
        board,
        2
      )
      const offendingCorners = getConnectedCornerNeighbors(board)
      const offending = _.uniqBy(
        _.flatten(offendingSubgraphs)
          .concat(offendingCorners)
          .filter((p) => !isLockedPiece(p.position)),
        (p) => `${p.position.x}-${p.position.y}`
      )
      if (offending.length === 0) {
        setBoard(board)
        console.log('found')
        return board
      }

      // When there are offending subgraphs, we know they contain pieces
      const random = assertDefined(randomFreePieceToRotate([offending]))
      changeRandomPiece(board, pieces, [random])
      // rotatePiece(board, random.position)

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
      // To make the algorithm async
      await new Promise((resolve) => setTimeout(resolve, 0))
    }
  }
}

/*
export async function systematic({ setBoard }: UiForAlgorithm) {
  let board: BoardType
  let pieces: Piece[]

  do {
    console.log('new loop')
    pieces = createPieceBag()
    board = createInitialBoardPieces()
    let placementTries = 0

    while (emptyPiecesCount(board) > 0) {
      // To make the algorithm async
      await new Promise((resolve) => setTimeout(resolve, 5))
      setBoard([...board])

      // Since the board has empty slots -> pieces array must be non-empty
      // as there will always be one piece left even after complete filling
      const index = getWeightedRandomPieceIndex(
        pieces as NonEmptyArray<Piece>
      )
      const piece = popIndex(pieces as NonEmptyArray<Piece>, index)
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
*/

export async function systematic2({ setBoard }: UiForAlgorithm) {
  const pieces = createPieceBag()
  const board = {
    pieces: createInitialBoardPieces() as FilledBoard['pieces'], // filled below
    playerPositions: {},
  }

  const maxBuffer = 10
  const noSolutions = createRingBuffer<number>({ max: maxBuffer })

  while (emptyPiecesCount(board) > 0) {
    // To make the algorithm async
    await new Promise((resolve) => setTimeout(resolve, 10))
    setBoard(board)

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
      setBoard(board)

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
        setBoard(board)
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

  return board

  /*
  setBoard(board)

  while (true) {
    await new Promise((resolve) => setTimeout(resolve, 100))
    const extra = pushWithPiece(
      board,
      { x: 1, y: 0, direction: 'down' },
      assertDefined(pieces.pop())
    )
    pieces.push(extra)
    setBoard(board)
  }
  */
}

export default Board
