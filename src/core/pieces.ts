import _ from 'lodash'
import { Board, Piece } from 'src/core/types'

export const createBoard: () => Board = () => {
  const initial: Array<Array<Piece | null>> = [
    [
      { type: 'corner', rotation: 90 },
      null,
      { type: 't-shape', rotation: 90, icon: 'KnightHelmet' },
      null,
      { type: 't-shape', rotation: 90, icon: 'ThreeCandles' },
      null,
      { type: 'corner', rotation: 180 },
    ],
    [null, null, null, null, null, null, null],
    [
      { type: 't-shape', icon: 'Dagger', rotation: 0 },
      null,
      { type: 't-shape', icon: 'Diamond', rotation: 0 },
      null,
      { type: 't-shape', rotation: 90, icon: 'TreasureChest' },
      null,
      { type: 't-shape', rotation: 180, icon: 'Ring' },
    ],
    [null, null, null, null, null, null, null],
    [
      { type: 't-shape', icon: 'HolyGrail', rotation: 0 },
      null,
      { type: 't-shape', rotation: 270, icon: 'Keys' },
      null,
      { type: 't-shape', rotation: 180, icon: 'Crown' },
      null,
      { type: 't-shape', rotation: 180, icon: 'Potion' },
    ],
    [null, null, null, null, null, null, null],
    [
      { type: 'corner', rotation: 0 },
      null,
      { type: 't-shape', rotation: 270, icon: 'Coins' },
      null,
      { type: 't-shape', rotation: 270, icon: 'Book' },
      null,
      { type: 'corner', rotation: 270 },
    ],
  ]

  return initial.map((row, y) =>
    row.map((piece, x) => (piece ? { ...piece, position: { x, y } } : null))
  )
}

export const createPieces: () => Piece[] = () =>
  _.shuffle(
    _.times<Piece>(12, () => ({ rotation: 0, type: 'straight' }))
      .concat(_.times(10, () => ({ rotation: 0, type: 'corner' })))
      .concat([
        { rotation: 0, type: 'corner', icon: 'Mouse' },
        { rotation: 0, type: 'corner', icon: 'Spider' },
        { rotation: 0, type: 't-shape', icon: 'Pony' },
        { rotation: 0, type: 't-shape', icon: 'Bat' },
        { rotation: 0, type: 't-shape', icon: 'Ghost' },
        { rotation: 0, type: 'corner', icon: 'Cat' },
        { rotation: 0, type: 't-shape', icon: 'Mermaid' },
        { rotation: 0, type: 't-shape', icon: 'Dinosaur' },
        { rotation: 0, type: 't-shape', icon: 'Goblin' },
        { rotation: 0, type: 'corner', icon: 'Owl' },
        { rotation: 0, type: 'corner', icon: 'Lizard' },
        { rotation: 0, type: 'corner', icon: 'Bug' },
      ])
  )
