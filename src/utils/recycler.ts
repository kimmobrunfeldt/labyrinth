import _ from 'lodash'
import { Logger } from 'src/utils/logger'
import { sleep } from 'src/utils/utils'

export type RecyclerOpts<T> = {
  factory: () => Promise<T>
  destroyer: (current: T) => Promise<void>
  autoRecycle?: (current: T, recycleCb: () => void) => void
  retryInterval?: number
  logger?: Logger
}

export type StopOptions = {
  destroy?: boolean
}
export type Recycler<T> = {
  current: T
  recycle: () => Promise<void>
  stop: (opts?: StopOptions) => Promise<void>
}

/**
 * Creates a recycler object. Useful for recreating hard-to-recover objects while
 * making the process easy for the caller.
 *
 * Example usage:
 *
 * const { current, recycle, stop } = await createRecycler({
 *   factory: async () => {
 *     const conn = await createDifficultConnection()
 *     return conn
 *   },
 *   destroyer: async (currentConn) => {
 *     // The destroyer must destroy the recycled object so that
 *     // the old connection won't end up calling callbacks
 *     currentConn.close()
 *   },
 *   autoRecycle: (justCreatedConn, cb) => {
 *     // Add as many triggers as you wish, cb ensures that it
 *     // only recycles once
 *     justCreatedConn.on('error', cb)
 *     justCreatedConn.on('close', cb)
 *   }
 * })
 */
export async function createRecycler<T>({
  factory,
  destroyer,
  autoRecycle,
  retryInterval = 5000,
  logger = console,
}: RecyclerOpts<T>): Promise<Recycler<T>> {
  let stopRecycle = false
  let current = await factory()
  initAutoRecycleTrigger(current)

  async function recycle() {
    logger.log('Recycling ...')
    await destroyer(current)
    while (!stopRecycle) {
      try {
        current = await factory()
        initAutoRecycleTrigger(current)
        break
      } catch (err) {
        logger.warn('Recycler failed to re-create', err)
      }

      await sleep(retryInterval)
    }
  }

  async function stop(opts: StopOptions = {}) {
    stopRecycle = true
    if (opts.destroy) {
      await destroyer(current)
    }
  }

  function initAutoRecycleTrigger(obj: T) {
    if (autoRecycle) {
      autoRecycle(
        obj,
        _.once(() => {
          if (stopRecycle) {
            return
          }

          void recycle()
        })
      )
    }
  }

  return {
    // The user of a recycler object can remain using the same object reference because
    // it links to this proxy. Recycler switches the underlying target transparently under
    // the hood.
    current: new Proxy(
      {},
      {
        // Dynamically forward all the traps to the associated methods on the mutable target
        get: (_target, prop, receiver) => {
          return Reflect.get(current as any, prop, receiver)
        },
        set: (_tarset, prop, receiver) => {
          return Reflect.get(current as any, prop, receiver)
        },
      }
    ) as T,
    recycle,
    stop,
  }
}
