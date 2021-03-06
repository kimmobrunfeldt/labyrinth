import _ from 'lodash'
import { createDeck } from 'src/core/server/pieces'
import * as t from 'src/gameTypes'
import { Logger } from './logger'

export class EventEmitter extends EventTarget {
  dispatch(eventType: string, meta: Record<string, unknown> = {}) {
    this.dispatchEvent(Object.assign(new Event(eventType), meta))
  }
}

export function getRandomPeerId(): string {
  const words = _.take(
    _.shuffle(createDeck()).filter((c) => c.trophy.length < 9),
    2
  ).map((c) => c.trophy.toLocaleLowerCase())
  const number = _.padStart(`${_.random(999)}`, 3, '0')
  return `${words.join('-')}-${number}`
}

export function getRandomAdminToken(): string {
  return _.padStart(`${_.random(9999)}`, 4, '0')
}

export function colorToName(color: t.PlayerColor) {
  return Object.entries(t.PlayerColor).find(
    ([_key, val]) => val === color
  )?.[0] as keyof typeof t.PlayerColor
}

export function getPlayerLabel(player?: t.Player | t.CensoredPlayer): string {
  return `${player?.name ?? 'Spectator'}`
}

export async function loopUntilSuccess<ArgsT>(
  fn: () => Promise<void>,
  optsIn: {
    onError?: (err: Error, ...args: ArgsT[]) => void
    maxTries?: number
    waitBeforeRetryMs?: number
  } = {}
) {
  const opts: Required<typeof optsIn> = {
    maxTries: 5,
    waitBeforeRetryMs: 0,
    onError: () => undefined,
    ...optsIn,
  }

  let tries = 1
  while (tries <= opts.maxTries) {
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

      await sleep(opts.waitBeforeRetryMs)
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
>(logger: Logger, methods: T): T {
  return _.mapValues(methods, (fn, key) => {
    if (!_.isFunction(fn)) {
      return fn
    }

    return async (...args: unknown[]) => {
      logger.log(`${key} called with ${args.length} arguments:\n`, args)

      try {
        return await fn(...args)
      } catch (e) {
        logger.error(e)
        throw e
      }
    }
  }) as T
}

export function wrapWithErrorIgnoring<
  T extends { [key: string]: (...args: any[]) => any }
>(logger: Logger, methods: T): T {
  return _.mapValues(methods, (fn, key) => {
    if (!_.isFunction(fn)) {
      return fn
    }

    return async (...args: unknown[]) => {
      try {
        return await fn(...args)
      } catch (e) {
        logger.info('Ignored error', e)
      }
    }
  }) as T
}

export function wrapAdminMethods<
  T extends { [key: string]: (...args: any[]) => any }
>(
  methods: T,
  serverAdminToken: string
): {
  [K in keyof T]: (token: string, ...args: Parameters<T[K]>) => ReturnType<T[K]>
} {
  return _.mapValues(methods, (fn) => {
    if (!_.isFunction(fn)) {
      return fn
    }

    return (token: string, ...args: any[]) => {
      if (token !== serverAdminToken) {
        throw new Error('Admin command not authorized')
      }

      return fn(...args)
    }
  })
}

export const format = {
  pos: (pos: t.Position) => {
    return `[${pos.x}, ${pos.y}]`
  },
}

type Emitter = {
  on: (...args: any[]) => void
}
export function waitForEvent(emitter: Emitter, eventName: string) {
  const errorAtCallsite = new Error()
  return new Promise((resolve, reject) => {
    emitter.on(eventName, (...args: unknown[]) => {
      resolve(args)
    })

    emitter.on('error', reject)
    setTimeout(() => {
      reject(
        Object.assign(errorAtCallsite, {
          message: `Timeout waiting for event '${eventName}'`,
        })
      )
    }, 10000)
  })
}

export function sleep(durationMs: number) {
  return new Promise((resolve) => setTimeout(resolve, durationMs))
}

export type MutableProxy<T> = {
  proxy: T
  setTarget: (newT: T) => void
}
export function createMutableProxy<T>(target: T): MutableProxy<T> {
  let currentTarget = target

  return {
    proxy: new Proxy(
      {},
      {
        // Dynamically forward all the traps to the associated methods on the mutable target
        get: (_target, prop, receiver) => {
          return Reflect.get(currentTarget as any, prop, receiver)
        },
        set: (_tarset, prop, receiver) => {
          return Reflect.get(currentTarget as any, prop, receiver)
        },
      }
    ) as T,

    setTarget(newTarget: T) {
      currentTarget = newTarget
    },
  }
}

export function oppositeIndex(arrayLength: number, index: number): number {
  return arrayLength - index - 1
}
