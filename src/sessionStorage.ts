export type Storage = {
  playerId: string
  serverPeerId: string
  adminPanelOpen: 'true' | 'false'
}

function isSupported() {
  const is = 'sessionStorage' in globalThis
  if (!is) {
    console.warn('Session storage not supported')
  }
  return is
}

export function getKey<T extends keyof Storage>(key: T): Storage[T] | null {
  if (!isSupported()) {
    return null
  }

  const sessionStorage = globalThis.sessionStorage as any
  try {
    return sessionStorage.getItem(key)
  } catch (e) {
    return null
  }
}

export function removeKey<T extends keyof Storage>(key: T): Storage[T] | null {
  if (!isSupported()) {
    return null
  }

  const sessionStorage = globalThis.sessionStorage as any
  try {
    return sessionStorage.removeItem(key)
  } catch (e) {
    return null
  }
}

export function saveKey<T extends keyof Storage>(
  key: T,
  value: Storage[T]
): Storage | null {
  if (!isSupported()) {
    return null
  }

  const sessionStorage = globalThis.sessionStorage as any
  try {
    sessionStorage.setItem(key, value)
  } catch (e) {
    return null
  }

  return sessionStorage
}
