import _ from 'lodash'
import { createPieces } from 'src/core/pieces'
import { Board, FilledBoard, Piece, Rotation } from 'src/core/types'

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

  return board.map((row) =>
    row.map((piece) => {
      if (piece || filled >= maxFillPieces) {
        return piece
      }

      filled += 1
      return {
        // We know there's enough pieces
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        ...pieces.pop()!,
        rotation: _.sample<Rotation>([0, 90, 180, 270]),
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
