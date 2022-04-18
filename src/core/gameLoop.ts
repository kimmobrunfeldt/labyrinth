import { createGame, CreateGameOptions } from 'src/core/game'
import * as t from 'src/core/types'

export async function createGameLoop(gameOpts: CreateGameOptions) {
  const game = createGame(gameOpts)

  const controlledPlayers: Record<string, t.ControlledPlayer> = {}

  // TODO: implement skip
  async function loopUntilSuccess<ArgsT>(
    fn: () => Promise<void>,
    errCb?: (err: Error, ...args: ArgsT[]) => void
  ) {
    while (true) {
      // Try until the promise succeeds
      try {
        return await fn()
      } catch (e) {
        if (errCb) {
          errCb(e as Error)
        }
        await new Promise((resolve) => setTimeout(resolve, 500))
        continue
      }
    }
  }

  async function sendStateToEveryone() {
    await Promise.all(
      Object.keys(controlledPlayers).map((key) =>
        controlledPlayers[key as keyof typeof controlledPlayers].onStateChange(
          game.getState()
        )
      )
    )
  }

  async function start() {
    game.start()
    await sendStateToEveryone()
  }

  async function addPlayer(
    info: Pick<t.Player, 'name' | 'color'>,
    createPlayer: (server: t.Server) => t.ControlledPlayer
  ) {
    const id = game.addPlayer(info)
    controlledPlayers[id] = createPlayer({
      getMyPosition: () => game.getPlayerPosition(id),
      getMyCurrentCards: () => game.getPlayersCurrentCards(id),
    })
  }

  async function turn() {
    const player = game.whosTurn()
    console.log('turn by', player.name)
    await loopUntilSuccess(
      async () => {
        console.log('push by', player.name)
        const playerPush = await controlledPlayers[
          player.id as keyof typeof controlledPlayers
        ].getPush()
        game.pushByPlayer(player.id, playerPush.position)
      },
      (err) => console.warn('player push failed', err)
    )

    await loopUntilSuccess(
      async () => {
        console.log('move by', player.name)
        const moveTo = await controlledPlayers[
          player.id as keyof typeof controlledPlayers
        ].getMove()

        game.moveByPlayer(player.id, moveTo)
      },
      (err) => console.warn('player move failed', err)
    )

    await loopUntilSuccess(sendStateToEveryone, (err) =>
      console.warn('send state to everyone failed:', err)
    )
  }

  return {
    turn,
    getState: game.getState,
    start,
    addPlayer,
  }
}
