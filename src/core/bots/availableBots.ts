import * as random from 'src/core/bots/random'

/**
 * Add newly created bots here
 */
export const availableBots = {
  random,
}

export type BotId = keyof typeof availableBots
