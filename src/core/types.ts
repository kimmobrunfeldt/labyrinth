export type Type = 'straight' | 'corner' | 't-shape'
export type Rotation = 0 | 90 | 180 | 270
export type Icon =
  | 'KnightHelmet'
  | 'ThreeCandles'
  | 'Mouse'
  | 'Spider'
  | 'Pony'
  | 'Dagger'
  | 'Diamond'
  | 'Bat'
  | 'TreasureChest'
  | 'Ghost'
  | 'Ring'
  | 'Cat'
  | 'Mermaid'
  | 'HolyGrail'
  | 'Dinosaur'
  | 'Keys'
  | 'Goblin'
  | 'Crown'
  | 'Potion'
  | 'Owl'
  | 'Coins'
  | 'Lizard'
  | 'Book'
  | 'Bug'

export type Piece = {
  type: Type
  rotation?: Rotation
  icon?: Icon
}
export type Board = Array<Array<Piece | null>>
export type FilledBoard = Array<Array<Piece>>
