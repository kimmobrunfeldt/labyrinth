import { GameControl, getCurrentCards } from 'src/core/server/game'
import * as t from 'src/gameTypes'
import { Logger } from 'src/utils/logger'
import { getPlayerLabel, wrapAdminMethods } from 'src/utils/utils'

export function createServerRpc({
  logger,
  adminToken,
  game,
  playerId,
  serverState,
  serverMethods,
}: {
  playerId: string
  logger: Logger
  adminToken: string
  game: GameControl
  serverState: t.ServerState
  serverMethods: t.ServerMethods
}): t.RpcProxy<t.ServerRpcAPI> {
  const adminRpc = {
    start: serverMethods.start,
    restart: serverMethods.restart,
    spectate: () => serverMethods.makeSpectator(playerId),
    promote: async () => game.promotePlayer(playerId),
    shuffleBoard: async (level?: t.ShuffleLevel) => {
      game.shuffleBoard(level)
    },
    changeSettings: async (settings: Partial<t.GameSettings>) => {
      game.changeSettings(settings)
    },
    removePlayer: async (id: t.Player['id']) => {
      const player = game.getPlayerById(id)
      logger.log(`Player '${getPlayerLabel(player)}' will be kicked`)

      if (id in serverState.players) {
        serverState.players[id].status = 'toBeKicked'
        // The clients will very aggressively reconnect, unless we explicitly
        // tell them that they are not welcome
        await serverState.players[id].clientRpc.onServerReject(
          'host kicked you out'
        )
        serverState.players[id].connection.disconnect()
        delete serverState.players[id]
      }

      game.removePlayer(id)
      serverMethods.sendMessage(
        `${getPlayerLabel(player)} disconnected (kicked)`
      )
    },
  }

  return {
    // Methods that require admin token
    ...wrapAdminMethods(adminRpc, adminToken),

    // Regular methods
    getState: async () =>
      getStateForPlayer(game, serverState.players, playerId),
    getMyPosition: async () => game.getPlayerPosition(playerId),
    getMyCurrentCards: async () => game.getPlayersCurrentCards(playerId),
    setExtraPieceRotation: async (rotation: t.Rotation) =>
      game.setExtraPieceRotationByPlayer(playerId, rotation),
    setPushPositionHover: async (position?: t.Position) => {
      const player = game.getPlayerById(playerId)

      if (!game.isPlayersTurn(playerId)) {
        throw new Error(
          `${getPlayerLabel(
            player
          )} is not in turn. Ignoring push position hover.`
        )
      }

      // Forward the information directly to all other clients
      Object.keys(serverMethods.getConnectedPlayers()).forEach((pId) => {
        if (playerId === pId) {
          // Don't send to the client itself
          return
        }

        serverState.players[
          pId as keyof typeof serverState.players
        ].clientRpc.onPushPositionHover(position)
      })
    },
    sendMessage: async (message: string) => {
      const player = game.getPlayerById(playerId)

      // Forward the information directly to all other clients
      Object.keys(serverMethods.getConnectedPlayers()).forEach((pId) => {
        serverState.players[
          pId as keyof typeof serverState.players
        ].clientRpc.onMessage(`${player.name} says: ${message}`)
      })
    },
    setMyName: async (name: string) => game.setNameByPlayer(playerId, name),
    move: async (moveTo: t.Position) => game.moveByPlayer(playerId, moveTo),
    push: async (pushPos: t.PushPosition) =>
      game.pushByPlayer(playerId, pushPos),
  }
}

export function getStateForPlayer(
  game: GameControl,
  serverPlayers: t.ServerState['players'],
  playerId: string
): t.ClientGameState {
  if (serverPlayers[playerId].spectator) {
    return getStateForSpectator(game, serverPlayers, playerId)
  }

  const { cards: _allGameCards, board, ...state } = game.getState()
  return {
    ...state,
    board: censorBoard(game, board),
    players: state.players.map((p) => ({
      ...censorPlayer(game, p),
      status: (serverPlayers[p.id].status === 'toBeKicked'
        ? 'disconnected'
        : serverPlayers[p.id].status) as t.PlayerConnectionStatus,
    })),
    me: censorPlayer(game, game.getPlayerById(playerId)),
    myCurrentCards: game.getPlayersCurrentCards(playerId),
    myPosition:
      game.getState().stage === 'setup'
        ? undefined
        : game.getPlayerPosition(playerId),
  }
}

export function getStateForSpectator(
  game: GameControl,
  serverPlayers: t.ServerState['players'],
  playerId: string
): t.ClientGameState {
  const gameState = game.getState()
  const playerInTurn: t.Player | undefined =
    gameState.players[gameState.playerTurn]

  const { cards: _allGameCards, board, ...state } = game.getState()
  return {
    ...state,
    board: censorBoard(game, board),
    players: state.players.map((p) => ({
      ...censorPlayer(game, p),
      status: (serverPlayers[p.id].status === 'toBeKicked'
        ? 'disconnected'
        : serverPlayers[p.id].status) as t.PlayerConnectionStatus,
    })),
    me: censorPlayer(game, {
      id: playerId,
      name: 'Spectator',
      originalName: 'Spectator',
      color: '#66666' as t.PlayerColor,
      cards: playerInTurn ? game.getPlayerById(playerInTurn.id).cards : [],
    }),
    myCurrentCards: playerInTurn
      ? game.getPlayersCurrentCards(playerInTurn.id)
      : [],
    myPosition:
      game.getState().stage === 'setup'
        ? undefined
        : game.getPlayerPosition(playerInTurn.id),
  }
}

function censorBoard(
  game: GameControl,
  board: t.Board
): t.ClientGameState['board'] {
  return {
    pieces: board.pieces.map((row) =>
      row.map((p) => {
        if (!p) {
          return p
        }
        const { players, ...rest } = p
        return {
          ...rest,
          players: players.map((player) => censorPlayer(game, player)),
        }
      })
    ),
  }
}

function censorPlayer(
  game: GameControl,
  { cards: playerCards, ...p }: t.Player
): t.CensoredPlayer {
  return {
    ...p,
    censoredCards: playerCards.map(
      (c): t.CensoredCard =>
        c.found ? { found: true, trophy: c.trophy } : { found: false }
    ),
    currentCards: getCurrentCards(playerCards),
  }
}
