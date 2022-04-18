import _ from 'lodash'
import {
  assertDefined,
  getPieceAt,
  isValidPlayerMove,
  pushWithPiece,
  randomFillBoard,
} from 'src/core/board'
import {
  createDeck as createCardDeck,
  createInitialBoardPieces,
  createPieceBag,
} from 'src/core/pieces'
import * as t from 'src/core/types'

export type CreateGameOptions = {
  onStateChange?: (game: t.Game) => void
  cardsPerPlayer?: number
}

export const format = {
  pos: (pos: t.Position) => {
    return `[${pos.x}, ${pos.y}]`
  },
}

export function createGame(opts: CreateGameOptions) {
  const onStateChange = opts.onStateChange ?? (() => undefined)
  const cardsPerPlayer = opts.cardsPerPlayer ?? 5

  const deck = createCardDeck()
  const gameState: Readonly<t.Game> = {
    stage: 'setup',
    cards: deck,
    pieceBag: createPieceBag(),
    board: {
      pieces: createInitialBoardPieces(),
    },
    players: [],
    playerWhoStarted: 0,
    playerTurn: 0,
    playerHasPushed: false,
    winners: [],
  }
  randomFillBoard(gameState.board, { pieceBag: gameState.pieceBag })

  /**
   * Helper function to ensure a state mutation is reflected to callback.
   * Proxy is another way to achieve the same effect, but ended up complicated
   * for no obvious upside in this case.
   */
  function mutator<ArgsT extends unknown[], ReturnT>(
    fn: (...args: ArgsT) => ReturnT
  ): (...args: ArgsT) => ReturnT {
    return (...args: ArgsT) => {
      const val = fn(...args)
      onStateChange(gameState)
      return val
    }
  }

  function stageGuard<ValidStages extends t.Game['stage'][]>(
    validStages: ValidStages
  ): t.GameByStages<ValidStages> {
    if (!gameIsOneOfStages(gameState, validStages)) {
      throw new Error(`Incorrect game stage: ${gameState.stage}`)
    }

    return gameState
  }

  const nextTurn = mutator(() => {
    const game = stageGuard(['playing'])
    if (getWinners().length > 0) {
      // TODO: Allow even out turns
      finish()
      return
    }
    console.log('increase player turn', game.players.length)
    game.playerTurn += 1
    if (game.playerTurn >= game.players.length) {
      game.playerTurn = 0
    }
    game.playerHasPushed = false
  })

  const start = mutator(() => {
    const game = stageGuard(['setup']) as t.Game
    if (game.pieceBag.length !== 1) {
      throw new Error(
        `Game must have exactly one piece in the bag when starting`
      )
    }

    game.stage = 'playing'
    // Choose random player to start
    game.playerTurn = assertDefined(_.sample(_.times(game.players.length)))
    console.log('Random starting player is', game.players[game.playerTurn].name)
    game.playerWhoStarted = game.playerTurn

    const corners = _.shuffle<t.Position>([
      { x: 0, y: 0 },
      { x: game.board.pieces[0].length - 1, y: 0 },
      { x: game.board.pieces[0].length - 1, y: game.board.pieces.length - 1 },
      { x: 0, y: game.board.pieces.length - 1 },
    ])
    game.players.forEach((player) => {
      setPlayerPosition(player.id, assertDefined(corners.pop()))
    })
  })

  const finish = mutator(() => {
    const game = stageGuard(['playing']) as t.Game

    game.stage = 'finished'
    const winners = getWinners()
    if (winners.length === 0) {
      throw new Error(`Game cannot finish without winners`)
    }
    game.winners = winners as t.NonEmptyArray<t.Player>
  })

  const addPlayer = mutator((player: Pick<t.Player, 'name' | 'color'>) => {
    const game = stageGuard(['setup'])

    if (game.players.length >= 4) {
      throw new Error('Max 4 players can play')
    }

    const p = player as t.Player
    p.cards = _.times(cardsPerPlayer).map(() => assertDefined(deck.pop()))
    p.id = _.uniqueId('player')
    game.players.push(p)

    return p.id
  })

  const removePlayer = mutator((id: string) => {
    const game = stageGuard(['setup'])
    game.players = game.players.filter((p) => p.id !== id)
  })

  const pushByPlayer = mutator((playerId: string, pushPos: t.PushPosition) => {
    const game = stageGuard(['playing'])

    if (!isPlayersTurn(playerId)) {
      throw new Error(`It's not ${playerId}'s turn`)
    }

    const extraPiece = assertDefined(game.pieceBag.pop())
    const { piece: newExtraPiece, originalPiece } = pushWithPiece(
      game.board,
      pushPos,
      extraPiece
    )
    // Transfer players to the other edge
    const addedPiece = getPieceAt(game.board, pushPos)
    addedPiece.players = originalPiece.players
    game.pieceBag.push(newExtraPiece)
    if (game.pieceBag.length !== 1) {
      throw new Error(
        `Unexpected amount of extra pieces: ${game.pieceBag.length}`
      )
    }
    game.playerHasPushed = true
  })

  const moveByPlayer = mutator((playerId: string, moveTo?: t.Position) => {
    const game = stageGuard(['playing'])

    if (!isPlayersTurn(playerId)) {
      throw new Error(`It's not ${playerId}'s turn`)
    }

    if (!game.playerHasPushed) {
      throw new Error(`Player must push first`)
    }

    if (moveTo) {
      const playerPos = assertDefined(getPlayerPosition(playerId))
      if (!isValidPlayerMove(game.board, playerPos, moveTo)) {
        throw new Error(
          `Not a valid player move for '${playerId}': ${format.pos(
            playerPos
          )} -> ${format.pos(moveTo)} `
        )
      }

      setPlayerPosition(playerId, moveTo)
    }

    maybeUpdateCardFound(playerById(playerId))
    nextTurn()
  })

  const maybeUpdateCardFound = mutator((player: t.Player) => {
    const game = stageGuard(['playing'])

    const pos = getPlayerPosition(player.id)
    const currentCards = getPlayersCurrentCards(player)
    const piece = getPieceAt(game.board, pos)
    const foundCard = currentCards.find((c) => c.trophy === piece.trophy)
    if (piece.trophy && foundCard) {
      foundCard.found = true
      console.log(`Player ${player.id} found trophy ${piece.trophy}`)
    }
  })

  function getPlayerPosition(playerId: string): t.Position {
    const game = stageGuard(['playing'])

    const pieces = _.flatten(game.board.pieces)
    const piece = _.find(pieces, (p) =>
      (p?.players ?? []).some((player) => player.id === playerId)
    )
    return assertDefined(piece).position
  }

  // XXX: does not validate move
  function setPlayerPosition(playerId: string, newPos: t.Position) {
    const game = stageGuard(['playing'])

    const pieces = _.flatten(gameState.board.pieces)
    const piece = _.find(pieces, (p) =>
      (p?.players ?? []).some((player) => player.id === playerId)
    )
    if (piece) {
      // Remove from old piece
      piece.players = piece.players.filter((p) => p.id !== playerId)
    }

    const newPiece = getPieceAt(game.board, newPos)
    newPiece.players.push(playerById(playerId))
  }

  function playerIndexById(playerId: string): number {
    return _.findIndex(gameState.players, (p) => p.id === playerId)
  }

  function playerById(playerId: string): t.Player {
    const found = _.find(gameState.players, (p) => p.id === playerId)
    if (!found) {
      throw new Error(`Player not found with id '${playerId}'`)
    }
    return found
  }

  function isPlayersTurn(playerId: string): boolean {
    const idx = playerIndexById(playerId)
    return gameState.playerTurn === idx
  }

  function getWinners() {
    return gameState.players.filter((p) => {
      const hasFoundAllCards = p.cards.every((c) => c.found)
      return hasFoundAllCards
    })
  }

  function whosTurn(): t.Player {
    return gameState.players[gameState.playerTurn]
  }

  return {
    getState: () => gameState as t.Game,
    start,
    addPlayer,
    removePlayer,
    pushByPlayer,
    moveByPlayer,
    whosTurn,
    getPlayerPosition,
    getPlayersCurrentCards: (playerId: string) =>
      getPlayersCurrentCards(playerById(playerId)),
  }
}

export function getPlayersBetweenCurrentAndPlayerWhoStarted(
  players: t.Player[],
  current: number,
  whoStarted: number
): t.Player[] {
  const between: t.Player[] = []
  while (current !== whoStarted) {
    current++
    if (current >= players.length) {
      current = 0
    }

    between.push(players[current])
  }

  return between
}

/**
 * Regular rules only allow single card to be found at a time, but let's model
 * the data so it would allow finding multiple cards at a time.
 */
function getPlayersCurrentCards(player: t.Player, max = 1): t.Card[] {
  const current: t.Card[] = []
  for (let i = 0; player.cards.length; ++i) {
    if (!player.cards[i].found) {
      current.push(player.cards[i])
      if (current.length >= max) {
        return current
      }
    }
  }
  return current
}

function gameIsOneOfStages<ValidStages extends t.GameStage[]>(
  game: t.Game,
  valid: ValidStages
): game is t.GameByStages<ValidStages> {
  return valid.includes(game.stage)
}
