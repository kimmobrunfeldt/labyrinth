import * as bigbrain from 'src/core/bots/bigbrain'
import * as random from 'src/core/bots/random'
import * as saboteur from 'src/core/bots/saboteur'

/**
 * Add newly created bots here
 */
export const availableBots = {
  random,
  bigbrain,
  saboteur,
}

export type BotId = keyof typeof availableBots
