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
