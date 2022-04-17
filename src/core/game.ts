import _ from 'lodash'
import {
  assertDefined,
  isValidPlayerMove,
  pushWithPiece,
  randomFillBoard,
} from 'src/core/board'
import {
  createDeck as createCardDeck,
  createInitialBoardPieces,
  createPieceBag,
} from 'src/core/pieces'
import {
  Card,
  Game,
  GameFinished,
  GamePlaying,
  GameSetup,
  Piece,
  Player,
  PlayerColor,
  Position,
  PushPosition,
} from 'src/core/types'

export type CreateGameOptions = {
  onStateChange: (game: Game) => void
}

export function createGame({ onStateChange }: CreateGameOptions) {
  const deck = createCardDeck()
  const gameState: Game = {
    state: 'setup',
    cards: deck,
    pieceBag: createPieceBag(),
    board: {
      pieces: createInitialBoardPieces(),
      playerPositions: {
        host: null,
      },
    },
    players: [createHostPlayer(deck)],
    playerTurn: 0,
  }
  randomFillBoard(gameState.board, { pieceBag: gameState.pieceBag })

  function nextTurn() {
    gameState.playerTurn += 1
    if (gameState.playerTurn >= gameState.players.length) {
      gameState.playerTurn = 0
    }
  }

  function getPlayerPosition(playerId: string) {
    return gameState.board.playerPositions[playerId]
  }

  function playerIndexById(playerId: string): number {
    return _.findIndex(gameState.players, (p) => p.id === playerId)
  }

  function isPlayersTurn(playerId: string): boolean {
    const idx = playerIndexById(playerId)
    return gameState.playerTurn === idx
  }

  function start() {
    if (!isSetup(gameState) as boolean) {
      console.error(`Incorrect game state: ${gameState.state}`)
      return
    }

    gameState.state = 'playing'
    // Choose random player to start
    gameState.playerTurn = assertDefined(
      _.sample(_.times(gameState.players.length))
    )
    onStateChange(gameState)
  }

  function addPlayer(player: Player) {
    if (!isSetup(gameState)) {
      console.error(`Incorrect game state: ${gameState.state}`)
      return
    }

    gameState.players.push(player)
    onStateChange(gameState)
  }

  function removePlayer(id: string) {
    if (!isSetup(gameState)) {
      console.error(`Incorrect game state: ${gameState.state}`)
      return
    }

    gameState.players = gameState.players.filter((p) => p.id !== id)
    onStateChange(gameState)
  }

  function pushByPlayer(playerId: string, pushPos: PushPosition, piece: Piece) {
    if (!isPlaying(gameState)) {
      console.error(`Incorrect game state: ${gameState.state}`)
      return
    }

    if (!isPlayersTurn(playerId)) {
      console.warn(`It's not ${playerId}'s turn`)
      return
    }

    pushWithPiece(gameState.board, pushPos, piece)
    onStateChange(gameState)
  }

  function moveByPlayer(playerId: string, moveTo?: Position) {
    if (!isPlaying(gameState)) {
      console.error(`Incorrect game state: ${gameState.state}`)
      return
    }

    if (!isPlayersTurn(playerId)) {
      console.warn(`It's not ${playerId}'s turn`)
      return
    }

    if (moveTo) {
      const playerPos = assertDefined(getPlayerPosition(playerId))
      if (!isValidPlayerMove(gameState.board, playerPos, moveTo)) {
        console.warn(
          `Not a valid player move for '${playerId}': ${playerPos} -> ${moveTo} `
        )
        return
      }

      gameState.board.playerPositions[playerId] = moveTo
    }

    nextTurn()
    onStateChange(gameState)
  }

  return {
    gameState,
    start,
    addPlayer,
    removePlayer,
    pushByPlayer,
    moveByPlayer,
  }
}

export function createHostPlayer(deck: Card[]): Player {
  return {
    id: 'host',
    name: 'Host',
    color: PlayerColor.Blue,
    cards: _.times(5).map(() => assertDefined(deck.pop())),
  }
}

export function isPlaying(game: Game): game is GamePlaying {
  return game.state === 'playing'
}

export function isFinished(game: Game): game is GameFinished {
  return game.state === 'finished'
}

export function isSetup(game: Game): game is GameSetup {
  return game.state === 'setup'
}
