import * as bigbrain from 'src/core/bots/bigbrain'
import * as random from 'src/core/bots/random'

/**
 * Add newly created bots here
 */
export const availableBots = {
  random,
  bigbrain,
}

export type BotId = keyof typeof availableBots
