export type Logger = ReturnType<typeof getLogger>
export function getLogger(label: string) {
  return {
    debug: (...args: unknown[]) => console.debug(label, ...args),
    info: (...args: unknown[]) => console.info(label, ...args),
    log: (...args: unknown[]) => console.log(label, ...args),
    warn: (...args: unknown[]) => console.warn(label, ...args),
    error: (...args: unknown[]) => console.error(label, ...args),
  }
}

export function prefixLogger(logger: Logger, prefix: string) {
  return {
    debug: (...args: unknown[]) => logger.debug(prefix, ...args),
    info: (...args: unknown[]) => logger.info(prefix, ...args),
    log: (...args: unknown[]) => logger.log(prefix, ...args),
    warn: (...args: unknown[]) => logger.warn(prefix, ...args),
    error: (...args: unknown[]) => logger.error(prefix, ...args),
  }
}

/**
 * Helps following the log messages for the host who might run many concurrent
 * clients along the server. Ultimately these would be the same colors as the
 * players, but this is also quite nice.
 */
const colorsAvailable = ['📗', '📘', '📙', '📒']
export function getUniqueEmoji(): string {
  return colorsAvailable.shift() ?? '📖'
}
