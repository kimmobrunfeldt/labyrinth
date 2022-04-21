import _ from 'lodash'
import { createDeck } from 'src/core/pieces'
import * as t from 'src/core/types'

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

export function getRandomAdminToken(): string {
  return _.padStart(`${_.random(9999)}`, 4, '0')
}

// TODO: implement turn skip on timeout
export async function loopUntilSuccess<ArgsT>(
  fn: () => Promise<void>,
  optsIn: {
    onError?: (err: Error, ...args: ArgsT[]) => void
    maxTries?: number
  } = {}
) {
  const opts = { maxTries: 5, ...optsIn }

  let tries = 1
  while (tries <= opts.maxTries) {
    console.log('try number', tries)
    // Try until the promise succeeds
    try {
      return await fn()
    } catch (e) {
      if (opts.onError) {
        opts.onError(e as Error)
      }

      if (tries >= opts.maxTries) {
        throw e
      }

      continue
    } finally {
      tries++
    }
  }
}

export function uuid() {
  // Public Domain/MIT
  let d = new Date().getTime()
  let d2 =
    (typeof performance !== 'undefined' &&
      performance.now &&
      performance.now() * 1000) ||
    0 //Time in microseconds since page-load or 0 if unsupported
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    let r = Math.random() * 16 //random number between 0 and 16
    if (d > 0) {
      //Use timestamp until depleted
      r = (d + r) % 16 | 0
      d = Math.floor(d / 16)
    } else {
      //Use microseconds since page-load if supported
      r = (d2 + r) % 16 | 0
      d2 = Math.floor(d2 / 16)
    }
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
  })
}

export function wrapWithLogging<
  T extends { [key: string]: (...args: any[]) => any }
>(label: string, methods: T): T {
  return _.mapValues(methods, (fn, key) => {
    return async (...args: unknown[]) => {
      console.log(
        `${label}: ${key}(${args.map((val) => JSON.stringify(val)).join(', ')})`
      )

      try {
        return await fn(...args)
      } catch (e) {
        console.error(e)
        throw e
      }
    }
  }) as T
}

export const format = {
  pos: (pos: t.Position) => {
    return `[${pos.x}, ${pos.y}]`
  },
}
