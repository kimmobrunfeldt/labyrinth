import _ from 'lodash'
import { Board, Piece } from 'src/core/types'

export const createBoard: () => Board = () => [
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
    { type: 't-shape', icon: 'Dagger' },
    null,
    { type: 't-shape', icon: 'Diamond' },
    null,
    { type: 't-shape', rotation: 90, icon: 'TreasureChest' },
    null,
    { type: 't-shape', rotation: 180, icon: 'Ring' },
  ],
  [null, null, null, null, null, null, null],
  [
    { type: 't-shape', icon: 'HolyGrail' },
    null,
    { type: 't-shape', rotation: 270, icon: 'Keys' },
    null,
    { type: 't-shape', rotation: 180, icon: 'Crown' },
    null,
    { type: 't-shape', rotation: 180, icon: 'Potion' },
  ],
  [null, null, null, null, null, null, null],
  [
    { type: 'corner' },
    null,
    { type: 't-shape', rotation: 270, icon: 'Coins' },
    null,
    { type: 't-shape', rotation: 270, icon: 'Book' },
    null,
    { type: 'corner', rotation: 270 },
  ],
]

export const createPieces: () => Piece[] = () =>
  _.shuffle(
    _.times<Piece>(12, () => ({ type: 'straight' }))
      .concat(_.times(10, () => ({ type: 'corner' })))
      .concat([
        { type: 'corner', icon: 'Mouse' },
        { type: 'corner', icon: 'Spider' },
        { type: 't-shape', icon: 'Pony' },
        { type: 't-shape', icon: 'Bat' },
        { type: 't-shape', icon: 'Ghost' },
        { type: 'corner', icon: 'Cat' },
        { type: 't-shape', icon: 'Mermaid' },
        { type: 't-shape', icon: 'Dinosaur' },
        { type: 't-shape', icon: 'Goblin' },
        { type: 'corner', icon: 'Owl' },
        { type: 'corner', icon: 'Lizard' },
        { type: 'corner', icon: 'Bug' },
      ])
  )
