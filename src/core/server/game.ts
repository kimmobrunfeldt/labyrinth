import _ from 'lodash'
import * as algo from 'src/core/server/algorithms'
import {
  assertDefined,
  getOppositePosition,
  getPieceAt,
  getPlayerPositionFromBoard,
  isValidPlayerMove,
  pushWithPiece,
} from 'src/core/server/board'
import {
  createDeck as createCardDeck,
  createInitialBoardPieces,
  createPieceBag,
  createPlayerColors,
} from 'src/core/server/pieces'
import * as t from 'src/gameTypes'
import { getLogger } from 'src/utils/logger'
import { format } from 'src/utils/utils'

const logger = getLogger('📓 SERVER:')
const PLAYER_DEFAULT_NAME = 'Player'

export type CreateGameOptions = {
  onStateChange?: (game: t.Game) => void
  cardsPerPlayer?: number
}

export type GameControl = ReturnType<typeof createGame>

export function createGame(opts: CreateGameOptions) {
  const onStateChange = opts.onStateChange ?? (() => undefined)

  // Note: Many other functions rely on object reference pointers.
  //       It is safe to do the shuffle before game starts, but after
  //       that it breaks the references.
  const shuffleBoard = mutator((level?: t.ShuffleLevel) => {
    const game = stageGuard(['setup'])

    const shuffleFn = algo.systematicRandom
    const { board, pieceBag } = shuffleFn({
      logger,
      level: level ?? game.settings.shuffleLevel,
    })
    game.board = board
    if (pieceBag.length !== 1) {
      throw new Error('Unexpected amount of pieces in bag')
    }
    game.pieceBag = pieceBag as [t.Piece]
  })

  const gameState = createInitialState(opts.cardsPerPlayer)
  shuffleBoard()

  /**
   * Helper function to ensure a state mutation is reflected to callback.
   * Proxy is another way to achieve the same effect, but ended up complicated
   * for no obvious upside in this case.
   */
  function mutator<ArgsT extends unknown[], ReturnT>(
    fn: (...args: ArgsT) => Promise<ReturnT> | ReturnT
  ): (...args: ArgsT) => Promise<ReturnT> | ReturnT {
    return (...args: ArgsT) => {
      const val = fn(...args)
      // TODO: How to prevent nested mutator calls to emit state change n times
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

  const changeSettings = mutator((settings: Partial<t.GameSettings>) => {
    const game = stageGuard(['setup'])
    if (
      settings.shuffleLevel &&
      settings.shuffleLevel !== game.settings.shuffleLevel
    ) {
      shuffleBoard(settings.shuffleLevel)
    }
    game.settings = { ...game.settings, ...settings }
  })

  const nextTurn = mutator(() => {
    const game = stageGuard(['playing'])
    if (getWinners().length > 0) {
      // TODO: Allow even out turns?
      finish()
      return
    }

    game.playerTurn += 1
    if (game.playerTurn >= game.players.length) {
      game.playerTurn = 0
    }
    game.playerHasPushed = false
    game.turnCounter += 1
  })

  const start = mutator(() => {
    const game = stageGuard(['setup']) as t.Game
    if (game.pieceBag.length !== 1) {
      throw new Error(
        `Game must have exactly one piece in the bag when starting`
      )
    }

    if (game.players.length < 1) {
      throw new Error(`Game must have at least one player`)
    }

    game.stage = 'playing'
    // Choose random player to start
    game.playerTurn = assertDefined(_.sample(_.times(game.players.length)))
    logger.log('Random starting player is', game.players[game.playerTurn].name)
    game.playerWhoStarted = game.playerTurn

    const corners = _.shuffle<t.Position>([
      { x: 0, y: 0 },
      { x: game.board.pieces[0].length - 1, y: 0 },
      { x: game.board.pieces[0].length - 1, y: game.board.pieces.length - 1 },
      { x: 0, y: game.board.pieces.length - 1 },
    ])
    game.players.forEach((player) => {
      setPlayerPosition(player.id, assertDefined(corners.pop()))

      // Deal cards
      player.cards = _.times(game.settings.trophyCount).map(() =>
        assertDefined(gameState.cards.pop())
      )
    })
  })

  const restart = mutator(() => {
    const game = gameState as t.Game
    const gameAny = game as any

    // Reset all values to initial state
    const {
      players: _players,
      playerColors: _playerColors,
      settings: _settings,
      ...initial
    } = createInitialState()
    const keys = Object.keys(initial) as Array<keyof typeof initial>
    keys.forEach((key) => {
      gameAny[key] = initial[key]
    })

    shuffleBoard()

    // Remove added state from players
    game.players.forEach((player) => {
      player.cards = []
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

  const addPlayer = mutator(
    (player: Pick<t.Player, 'id'> & { name?: string }) => {
      const game = stageGuard(['setup'])

      if (game.players.length >= 4 || gameState.playerColors.length === 0) {
        throw new Error('Server is full')
      }

      const p = player as t.Player
      p.cards = []
      p.color = assertDefined(gameState.playerColors.pop())
      p.originalName = player.name ?? PLAYER_DEFAULT_NAME
      p.name = resolvePlayerName(p.originalName, game.players.length)
      game.players.push(p)
      return p.id
    }
  )

  const removePlayer = mutator((id: string) => {
    const game = stageGuard(['setup'])
    const player = getPlayerById(id)
    game.players = game.players.filter((p) => p.id !== id)
    game.playerColors.push(player.color)
    resetPlayerVisibleNames()
  })

  // Promotes player as the first player.
  // This is a bit of an edge-case but if another player connects before
  // the admin player, the setup stage is in a weird state.
  // The first player has some special rights at the setup stage
  // because playerTurn is set to 0.
  const promotePlayer = mutator((id: string) => {
    const game = stageGuard(['setup'])

    const index = playerIndexById(id)
    // Remove the promoted player
    const [promotedPlayer] = game.players.splice(index, 1)
    // Add promoted player as the first
    game.players.unshift(promotedPlayer)

    resetPlayerVisibleNames()

    // Re-assign colors in the original order
    game.playerColors = createPlayerColors()
    game.players.forEach((player) => {
      player.color = assertDefined(game.playerColors.pop())
    })
  })

  const pushByPlayer = mutator((playerId: string, pushPos: t.PushPosition) => {
    const game = stageGuard(['playing'])

    if (!isPlayersTurn(playerId)) {
      throw new Error(`It's not ${playerId}'s turn`)
    }

    if (game.playerHasPushed) {
      throw new Error(`Player ${playerId} already pushed`)
    }

    if (game.previousPushPosition) {
      const opposite = getOppositePosition(
        game.board.pieces.length,
        game.previousPushPosition
      )
      if (pushPos.x === opposite.x && pushPos.y === opposite.y) {
        throw new Error(
          `Illegal push position ${format.pos(
            pushPos
          )}. Cannot revert previous push.`
        )
      }
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
    game.previousPushPosition = pushPos
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

    maybeUpdateCardFound(getPlayerById(playerId))
    nextTurn()
  })

  const setExtraPieceRotationByPlayer = mutator(
    (playerId: string, rotation: t.Rotation) => {
      const game = stageGuard(['playing'])

      if (![0, 90, 180, 270].includes(rotation)) {
        throw new Error(`Invalid rotation: ${rotation}`)
      }

      if (!isPlayersTurn(playerId)) {
        throw new Error(`It's not ${playerId}'s turn`)
      }

      game.pieceBag[0].rotation = rotation
    }
  )

  const setNameByPlayer = mutator((playerId: string, name: string) => {
    const index = playerIndexById(playerId)
    gameState.players[index].originalName = name
    gameState.players[index].name = resolvePlayerName(name, index)
  })

  const maybeUpdateCardFound = mutator((player: t.Player) => {
    const game = stageGuard(['playing'])

    const pos = getPlayerPosition(player.id)
    const currentCards = getPlayersCurrentCards(player)
    const piece = getPieceAt(game.board, pos)
    const foundCard = currentCards.find((c) => c.trophy === piece.trophy)
    if (piece.trophy && foundCard) {
      foundCard.found = true
      logger.log(`Player ${player.id} found trophy ${piece.trophy}`)
    }
  })

  function getPlayerPosition(playerId: string): t.Position {
    const game = stageGuard(['playing', 'finished'])
    return getPlayerPositionFromBoard(game.board, playerId)
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
    newPiece.players.push(getPlayerById(playerId))
  }

  function resolvePlayerName(name: string, playerIndex: number): string {
    const playersWithSameName = gameState.players.filter(
      (p, index) =>
        p.originalName.toLowerCase() === name.toLowerCase() &&
        index < playerIndex
    )

    return `${name} ${playersWithSameName.length + 1}`
  }

  function resetPlayerVisibleNames() {
    const game = stageGuard(['setup'])
    game.players.forEach((player, index) => {
      player.name = resolvePlayerName(player.originalName, index)
    })
  }

  function playerIndexById(playerId: string): number {
    return _.findIndex(gameState.players, (p) => p.id === playerId)
  }

  function getPlayerById(playerId: string): t.Player {
    const found = _.find(gameState.players, (p) => p.id === playerId)
    if (!found) {
      throw new Error(`Player not found with id '${playerId}'`)
    }
    return found
  }

  function maybeGetPlayerById(playerId: string): t.Player | undefined {
    return _.find(gameState.players, (p) => p.id === playerId)
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

  function getExtraPieceRotation(): t.Rotation {
    return gameState.pieceBag[0].rotation
  }

  function whosTurn(): t.Player {
    return gameState.players[gameState.playerTurn]
  }

  return {
    getState: () => gameState as t.Game,
    changeSettings,
    restart,
    start,
    shuffleBoard,
    addPlayer,
    getPlayerById,
    maybeGetPlayerById,
    removePlayer,
    promotePlayer,
    pushByPlayer,
    moveByPlayer,
    nextTurn,
    whosTurn,
    isPlayersTurn,
    getPlayerPosition,
    getPlayersCurrentCards: (playerId: string) =>
      getPlayersCurrentCards(getPlayerById(playerId)),
    getExtraPieceRotation,
    setExtraPieceRotationByPlayer,
    setNameByPlayer,
  }
}

export function createInitialState(cardsPerPlayer = 5) {
  const deck = createCardDeck()
  const initial: Readonly<t.Game> = {
    stage: 'setup',
    cards: deck,
    pieceBag: createPieceBag(),
    board: {
      pieces: createInitialBoardPieces(),
    },
    playerColors: createPlayerColors(),
    players: [],
    playerWhoStarted: 0,
    playerTurn: 0,
    playerHasPushed: false,
    winners: [],
    previousPushPosition: undefined,
    turnCounter: 0,
    settings: {
      trophyCount: cardsPerPlayer,
      shuffleLevel: 'hard',
    },
  }
  return initial
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
  for (let i = 0; i < player.cards.length; ++i) {
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
