import * as t from 'src/gameTypes'

export function createLocalPlayer(ui: t.PlayerUI) {
  return (server: t.ServerRpcAPI) => {
    let gameState: t.GamePlaying | t.GameFinished

    return {
      onStateChange: async (game: t.Game) => {
        gameState = game as t.GamePlaying | t.GameFinished
      },
      getPush: async () => {
        console.log(
          'current',
          server.getMyCurrentCards().map((c) => c.trophy)
        )
        return await ui.askForPush()
      },
      getMove: async () => {
        console.log(
          'current',
          server.getMyCurrentCards().map((c) => c.trophy)
        )
        return await ui.askForMove()
      },
    }
  }
}
