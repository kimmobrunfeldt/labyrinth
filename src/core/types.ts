// Game
export type GameCommonProperties = {
  players: Player[]
  cards: Card[]
  playerTurn: number
}
export type Game = GameSetup | GamePlaying | GameFinished
export type GameSetup = GameCommonProperties & {
  state: 'setup'
  board: Board
  pieceBag: Piece[]
}
export type GamePlaying = GameCommonProperties & {
  state: 'playing'
  board: FilledBoard
  pieceBag: [Piece]
}
export type GameFinished = GameCommonProperties & {
  state: 'finished'
  board: FilledBoard
  pieceBag: [Piece]
}

// Player
export type Player = {
  id: string
  name: string
  color: PlayerColor
  cards: Card[]
}
export type Host = {
  playerId: Player['id']
}
export enum PlayerColor {
  Red = '#EB5757',
  Orange = '#F2994A',
  Blue = '#2F80ED',
  Violet = '#9B51E0',
}

// Board

export type Board = {
  pieces: Array<Array<PieceOnBoard | null>>
  playerPositions: Record<string, Position | null>
}
export type FilledBoard = {
  pieces: Array<Array<PieceOnBoard>>
  playerPositions: Record<string, Position>
}
export type Position = {
  x: number
  y: number
}
export type NeighborPosition = Position & { direction: Direction }
export type PushPosition = Position & { direction: Direction }
export type Direction = 'up' | 'right' | 'down' | 'left'
export type WalkableDirections = Record<Direction, boolean>
export type ConnectedPieces = PieceOnBoard[]
export type PieceOnBoard = Omit<Piece, 'position'> & {
  position: Position
}
export type NeighborPiece = {
  piece: PieceOnBoard
  direction: Direction
}

// Piece
export type Type = 'straight' | 'corner' | 't-shape'
export type Rotation = 0 | 90 | 180 | 270
export type Trophy =
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
  id: string
  type: Type
  rotation: Rotation
  trophy?: Trophy
  position?: Position
}

// Cards
export type Card = {
  trophy: Trophy
  visible: boolean
  found: boolean
}

// Utils

export type NonEmptyArray<T> = [T, ...T[]]
export function isNonEmptyArray<T>(arr: T[]): arr is NonEmptyArray<T> {
  return arr.length > 0
}
