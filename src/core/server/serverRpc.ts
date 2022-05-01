import MoleServer from 'mole-rpc/MoleServer'
import Peer from 'peerjs'
import { GameControl } from 'src/core/server/game'
import * as t from 'src/gameTypes'
import { getLogger, Logger } from 'src/utils/logger'
import { PeerJsTransportServer } from 'src/utils/TransportServer'
import {
  getPlayerLabel,
  wrapAdminMethods,
  wrapWithLogging,
} from 'src/utils/utils'

export function startServerRpcForClient({
  logger,
  connection,
  adminToken,
  game,
  playerId,
  mutableServerState,
  serverMethods,
}: {
  playerId: string
  connection: Peer.DataConnection
  logger: Logger
  adminToken: string
  game: GameControl
  mutableServerState: t.ServerState
  serverMethods: t.ServerMethods
}) {
  const server = new MoleServer({
    transports: [],
  })
  const serverRpc: t.PromisifyMethods<t.ServerRpcAPI> = {
    getState: async () =>
      getStateForPlayer(
        game,
        playerId,
        mutableServerState.players[playerId].status
      ),
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

        mutableServerState.players[
          pId as keyof typeof mutableServerState.players
        ].client.onPushPositionHover(position)
      })
    },
    setMyName: async (name: string) => game.setNameByPlayer(playerId, name),
    move: async (moveTo: t.Position) => game.moveByPlayer(playerId, moveTo),
    push: async (pushPos: t.PushPosition) =>
      game.pushByPlayer(playerId, pushPos),
    ...wrapAdminMethods(
      {
        start: serverMethods.start,
        restart: serverMethods.restart,
        promote: async () => game.promotePlayer(playerId),
        shuffleBoard: async (level?: t.ShuffleLevel) => {
          game.shuffleBoard(level)
        },
        removePlayer: async (id: t.Player['id']) => {
          const player = game.getPlayerById(id)
          logger.log(`Player '${getPlayerLabel(player)}' will be kicked`)

          if (id in mutableServerState.players) {
            mutableServerState.players[id].status = 'toBeKicked'
            await mutableServerState.players[id].client.onServerReject(
              'host kicked you out'
            )
            mutableServerState.players[id].connection.close()
            delete mutableServerState.players[id]
          }

          game.removePlayer(id)
          serverMethods.sendMessage(
            `${getPlayerLabel(player)} disconnected (kicked)`
          )
        },
        changeSettings: async (settings: Partial<t.GameSettings>) => {
          game.changeSettings(settings)
        },
      },
      adminToken
    ),
  }
  const rpcLogger = getLogger(`SERVER RPC (${playerId}):`)
  server.expose(wrapWithLogging(rpcLogger, serverRpc))
  server.registerTransport(
    new PeerJsTransportServer({
      peerConnection: connection,
    })
  )
  return server
}

export function getStateForPlayer(
  game: GameControl,
  playerId: string,
  playerConnectionStatus: t.InternalPlayerConnectionStatus
): t.ClientGameState {
  function censorPlayer({
    cards: playerCards,
    ...p
  }: t.Player): t.CensoredPlayer {
    return {
      ...p,
      censoredCards: playerCards.map(
        (c): t.CensoredCard =>
          c.found ? { found: true, trophy: c.trophy } : { found: false }
      ),
      currentCards: game.getPlayersCurrentCards(p.id),
    }
  }

  const { cards: _allGameCards, board, ...state } = game.getState()
  return {
    ...state,
    board: {
      pieces: board.pieces.map((row) =>
        row.map((p) => {
          if (!p) {
            return p
          }
          const { players, ...rest } = p
          return {
            ...rest,
            players: players.map(censorPlayer),
          }
        })
      ),
    },
    players: state.players.map((p) => ({
      ...censorPlayer(p),
      status: (playerConnectionStatus === 'toBeKicked'
        ? 'disconnected'
        : playerConnectionStatus) as t.PlayerConnectionStatus,
    })),
    me: censorPlayer(game.getPlayerById(playerId)),
    myCurrentCards: game.getPlayersCurrentCards(playerId),
    myPosition:
      game.getState().stage === 'setup'
        ? undefined
        : game.getPlayerPosition(playerId),
  }
}
