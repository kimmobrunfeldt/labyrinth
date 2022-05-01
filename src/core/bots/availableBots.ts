import { connectBot as connectRandomBot } from 'src/core/bots/random'

/**
 * Add newly created bots here
 */
export const availableBots = {
  random: connectRandomBot,
}

export type BotId = keyof typeof availableBots
