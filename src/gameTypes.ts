// Game control loop

export type PlayerUI = {
  askForPush: () => Promise<{ position: PushPosition; rotation: Rotation }>
  askForMove: () => Promise<Position>
}

export type ServerRpcAPI = {
  getState: () => ClientGameState
  getMyPosition: () => Position
  getMyCurrentCards: () => Card[]
  setExtraPieceRotation: (rotation: Rotation) => void
  setMyName: (name: string) => void
} & {
  // Admin API
  start: (adminToken: string) => void
}

export type ClientRpcAPI = {
  onStateChange: (gameState: ClientGameState) => void
  getPush: () => PushPosition
  getMove: () => Position
}

// XXX: There's a risk of leaking private attributes from Game object using this approach
export type ClientGameState = Omit<Game, 'board' | 'cards' | 'players'> & {
  board: Omit<Board, 'pieces'> & {
    pieces: Array<Array<CensoredPieceOnBoard | null>>
  }
  players: Array<CensoredPlayer>
  me: CensoredPlayer
  myCurrentCards: Card[]
  myPosition?: Position
}

// Game
export type GameCommonProperties = {
  playerColors: PlayerColor[]
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
  previousPushPosition: undefined
}
export type GamePlaying = GameCommonProperties & {
  stage: 'playing'
  board: FilledBoard
  pieceBag: [Piece]
  winners: []
  previousPushPosition: PushPosition
}
export type GameFinished = GameCommonProperties & {
  stage: 'finished'
  board: FilledBoard
  pieceBag: [Piece]
  winners: NonEmptyArray<Player>
  previousPushPosition: PushPosition
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
export type CensoredPlayer = Omit<Player, 'cards'> & {
  currentCards: Card[]
  censoredCards: CensoredCard[]
}
export type Host = {
  playerId: Player['id']
}
export enum PlayerColor {
  Red = '#EB5757',
  Orange = '#F2994A',
  Blue = '#2F80ED',
  Purple = '#9B51E0',
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
export type CensoredPieceOnBoard = Omit<Piece, 'position'> & {
  position: Position
  players: CensoredPlayer[]
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
  | 'Bomb'
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
  | 'Cannon'
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
export type CensoredCard =
  | {
      trophy: Trophy
      found: true
    }
  | {
      found: false
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

export type PromisifyMethods<
  T extends { [key: string]: (...args: any[]) => any }
> = {
  [K in keyof T]: (...args: Parameters<T[K]>) => Promise<ReturnType<T[K]>>
}
