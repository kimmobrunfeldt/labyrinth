import _ from 'lodash'
import { Board, Card, Piece, PlayerColor } from 'src/gameTypes'

export const PIECE_ID_PREFIX = 'piece'

export const createInitialBoardPieces: () => Board['pieces'] = () => {
  const initial: Array<Array<Omit<Piece, 'id'> | null>> = [
    [
      { type: 'corner', rotation: 90 },
      null,
      { type: 't-shape', rotation: 90, trophy: 'KnightHelmet' },
      null,
      { type: 't-shape', rotation: 90, trophy: 'Candles' },
      null,
      { type: 'corner', rotation: 180 },
    ],
    [null, null, null, null, null, null, null],
    [
      { type: 't-shape', trophy: 'Dagger', rotation: 0 },
      null,
      { type: 't-shape', trophy: 'Diamond', rotation: 0 },
      null,
      { type: 't-shape', rotation: 90, trophy: 'Treasure' },
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
        ? {
            ...piece,
            id: _.uniqueId(PIECE_ID_PREFIX),
            position: { x, y },
            players: [],
          }
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
        { rotation: 0, type: 'corner', trophy: 'Bomb' },
        { rotation: 0, type: 't-shape', trophy: 'Pony' },
        { rotation: 0, type: 't-shape', trophy: 'Bat' },
        { rotation: 0, type: 't-shape', trophy: 'Ghost' },
        { rotation: 0, type: 'corner', trophy: 'Cat' },
        { rotation: 0, type: 't-shape', trophy: 'Mermaid' },
        { rotation: 0, type: 't-shape', trophy: 'Dinosaur' },
        { rotation: 0, type: 't-shape', trophy: 'Cannon' },
        { rotation: 0, type: 'corner', trophy: 'Owl' },
        { rotation: 0, type: 'corner', trophy: 'Lizard' },
        { rotation: 0, type: 'corner', trophy: 'Bug' },
      ])
  ).map((p) => ({ ...p, id: _.uniqueId(PIECE_ID_PREFIX) }))

export const createDeck: () => Card[] = () =>
  _.shuffle([
    { found: false, trophy: 'KnightHelmet' },
    { found: false, trophy: 'Candles' },
    { found: false, trophy: 'Dagger' },
    { found: false, trophy: 'Diamond' },
    { found: false, trophy: 'Treasure' },
    { found: false, trophy: 'Ring' },
    { found: false, trophy: 'HolyGrail' },
    { found: false, trophy: 'Keys' },
    { found: false, trophy: 'Crown' },
    { found: false, trophy: 'Potion' },
    { found: false, trophy: 'Coins' },
    { found: false, trophy: 'Book' },
    { found: false, trophy: 'Mouse' },
    { found: false, trophy: 'Bomb' },
    { found: false, trophy: 'Pony' },
    { found: false, trophy: 'Bat' },
    { found: false, trophy: 'Ghost' },
    { found: false, trophy: 'Cat' },
    { found: false, trophy: 'Mermaid' },
    { found: false, trophy: 'Dinosaur' },
    { found: false, trophy: 'Cannon' },
    { found: false, trophy: 'Owl' },
    { found: false, trophy: 'Lizard' },
    { found: false, trophy: 'Bug' },
  ])

export const createPlayerColors = () => [
  PlayerColor.Blue,
  PlayerColor.Red,
  PlayerColor.Orange,
  PlayerColor.Purple,
]
