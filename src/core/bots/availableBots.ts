import * as bigbrain from 'src/core/bots/bigbrain'
import * as fastRandom from 'src/core/bots/fastRandom'
import * as random from 'src/core/bots/random'

/**
 * Add newly created bots here
 */
export const availableBots = {
  random,
  fastRandom,
  bigbrain,
}

export type BotId = keyof typeof availableBots
