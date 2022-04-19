import _ from 'lodash'
import { createDeck } from 'src/core/pieces'

export class EventEmitter extends EventTarget {
  dispatch(eventType: string, meta: Record<string, unknown> = {}) {
    this.dispatchEvent(Object.assign(new Event(eventType), meta))
  }
}

export function getRandomPeerId(): string {
  const words = _.take(_.shuffle(createDeck()), 2).map((c) =>
    c.trophy.toLocaleLowerCase()
  )
  const number = _.padStart(`${_.random(999)}`, 3, '0')
  return `${words.join('-')}-${number}`
}
