// Game control loop

export type PlayerUI = {
  askForPush: () => Promise<{ position: PushPosition; rotation: Rotation }>
  askForMove: () => Promise<Position>
}

// TODO: Separate public and private state
export type Server = {
  getMyPosition: () => Position
  getMyCurrentCards: () => Card[]

  // TODO: implement
  setExtraPieceRotation?: (rotation: Rotation) => Promise<void>
  setMyName?: (name: string) => Promise<void>
}

export type ControlledPlayer = {
  onStateChange: (gameState: Game) => Promise<void>
  getPush: () => Promise<{
    position: PushPosition
    rotation: Rotation
  }>
  getMove: () => Promise<Position>
}

export type PublicGame = Omit<Game, 'cards' | 'players'> & {
  players: Array<Omit<Player, 'cards'> & { currentCards: Card[] }>
}

// Game
export type GameCommonProperties = {
  players: Player[]
  cards: Card[]
  playerHasPushed: boolean
  playerTurn: number
  playerWhoStarted: number
}
export type Game = GameSetup | GamePlaying | GameFinished
export type GameStage = 'setup' | 'playing' | 'finished'
export type GameSetup = GameCommonProperties & {
  stage: 'setup'
  board: Board
  pieceBag: Piece[]
  winners: []
}
export type GamePlaying = GameCommonProperties & {
  stage: 'playing'
  board: FilledBoard
  pieceBag: [Piece]
  winners: []
}
export type GameFinished = GameCommonProperties & {
  stage: 'finished'
  board: FilledBoard
  pieceBag: [Piece]
  winners: NonEmptyArray<Player>
}
export type GameByStages<T extends GameStage[]> = {
  [K in keyof T]: Game & { stage: T[K] }
}[number]

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
}
export type FilledBoard = {
  pieces: Array<Array<PieceOnBoard>>
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
  players: Player[]
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
  | 'Candles'
  | 'Mouse'
  | 'Spider'
  | 'Pony'
  | 'Dagger'
  | 'Diamond'
  | 'Bat'
  | 'Treasure'
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
  found: boolean
}

// Utils

export type NonEmptyArray<T> = [T, ...T[]]
export function isNonEmptyArray<T>(arr: T[]): arr is NonEmptyArray<T> {
  return arr.length > 0
}

export type NonStrictParameters<F> = F extends (...args: unknown[]) => unknown
  ? Parameters<F>
  : never

export type NonStrictReturnType<F> = F extends (...args: unknown[]) => unknown
  ? ReturnType<F>
  : never
