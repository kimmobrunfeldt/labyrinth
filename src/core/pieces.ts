import _ from 'lodash'
import { Board, Card, Piece } from 'src/core/types'

export const PIECE_ID_PREFIX = 'piece'

export const createInitialBoardPieces: () => Board['pieces'] = () => {
  const initial: Array<Array<Omit<Piece, 'id'> | null>> = [
    [
      { type: 'corner', rotation: 90 },
      null,
      { type: 't-shape', rotation: 90, trophy: 'KnightHelmet' },
      null,
      { type: 't-shape', rotation: 90, trophy: 'ThreeCandles' },
      null,
      { type: 'corner', rotation: 180 },
    ],
    [null, null, null, null, null, null, null],
    [
      { type: 't-shape', trophy: 'Dagger', rotation: 0 },
      null,
      { type: 't-shape', trophy: 'Diamond', rotation: 0 },
      null,
      { type: 't-shape', rotation: 90, trophy: 'TreasureChest' },
      null,
      { type: 't-shape', rotation: 180, trophy: 'Ring' },
    ],
    [null, null, null, null, null, null, null],
    [
      { type: 't-shape', trophy: 'HolyGrail', rotation: 0 },
      null,
      { type: 't-shape', rotation: 270, trophy: 'Keys' },
      null,
      { type: 't-shape', rotation: 180, trophy: 'Crown' },
      null,
      { type: 't-shape', rotation: 180, trophy: 'Potion' },
    ],
    [null, null, null, null, null, null, null],
    [
      { type: 'corner', rotation: 0 },
      null,
      { type: 't-shape', rotation: 270, trophy: 'Coins' },
      null,
      { type: 't-shape', rotation: 270, trophy: 'Book' },
      null,
      { type: 'corner', rotation: 270 },
    ],
  ]

  return initial.map((row, y) =>
    row.map((piece, x) =>
      piece
        ? { ...piece, id: _.uniqueId(PIECE_ID_PREFIX), position: { x, y } }
        : null
    )
  )
}

export const createPieceBag: () => Piece[] = () =>
  _.shuffle(
    _.times<Omit<Piece, 'id'>>(12, () => ({ rotation: 0, type: 'straight' }))
      .concat(_.times(10, () => ({ rotation: 0, type: 'corner' })))
      .concat([
        { rotation: 0, type: 'corner', trophy: 'Mouse' },
        { rotation: 0, type: 'corner', trophy: 'Spider' },
        { rotation: 0, type: 't-shape', trophy: 'Pony' },
        { rotation: 0, type: 't-shape', trophy: 'Bat' },
        { rotation: 0, type: 't-shape', trophy: 'Ghost' },
        { rotation: 0, type: 'corner', trophy: 'Cat' },
        { rotation: 0, type: 't-shape', trophy: 'Mermaid' },
        { rotation: 0, type: 't-shape', trophy: 'Dinosaur' },
        { rotation: 0, type: 't-shape', trophy: 'Goblin' },
        { rotation: 0, type: 'corner', trophy: 'Owl' },
        { rotation: 0, type: 'corner', trophy: 'Lizard' },
        { rotation: 0, type: 'corner', trophy: 'Bug' },
      ])
  ).map((p) => ({ ...p, id: _.uniqueId(PIECE_ID_PREFIX) }))

export const createDeck: () => Card[] = () =>
  _.shuffle([
    { visible: false, found: false, trophy: 'KnightHelmet' },
    { visible: false, found: false, trophy: 'ThreeCandles' },
    { visible: false, found: false, trophy: 'Dagger' },
    { visible: false, found: false, trophy: 'Diamond' },
    { visible: false, found: false, trophy: 'TreasureChest' },
    { visible: false, found: false, trophy: 'Ring' },
    { visible: false, found: false, trophy: 'HolyGrail' },
    { visible: false, found: false, trophy: 'Keys' },
    { visible: false, found: false, trophy: 'Crown' },
    { visible: false, found: false, trophy: 'Potion' },
    { visible: false, found: false, trophy: 'Coins' },
    { visible: false, found: false, trophy: 'Book' },
    { visible: false, found: false, trophy: 'Mouse' },
    { visible: false, found: false, trophy: 'Spider' },
    { visible: false, found: false, trophy: 'Pony' },
    { visible: false, found: false, trophy: 'Bat' },
    { visible: false, found: false, trophy: 'Ghost' },
    { visible: false, found: false, trophy: 'Cat' },
    { visible: false, found: false, trophy: 'Mermaid' },
    { visible: false, found: false, trophy: 'Dinosaur' },
    { visible: false, found: false, trophy: 'Goblin' },
    { visible: false, found: false, trophy: 'Owl' },
    { visible: false, found: false, trophy: 'Lizard' },
    { visible: false, found: false, trophy: 'Bug' },
  ])
