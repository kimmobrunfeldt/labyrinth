export type Storage = {
  adminPanelOpen: 'true' | 'false'
  playerLabelsHidden: 'true' | 'false'
}

function isSupported() {
  const is = 'localStorage' in globalThis
  if (!is) {
    console.warn('Local storage not supported')
  }
  return is
}

export function getKey<T extends keyof Storage>(key: T): Storage[T] | null {
  if (!isSupported()) {
    return null
  }

  const localStorage = globalThis.localStorage as any
  try {
    return localStorage.getItem(key)
  } catch (e) {
    return null
  }
}

export function removeKey<T extends keyof Storage>(key: T): Storage[T] | null {
  if (!isSupported()) {
    return null
  }

  const localStorage = globalThis.localStorage as any
  try {
    return localStorage.removeItem(key)
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

  const localStorage = globalThis.localStorage as any
  try {
    localStorage.setItem(key, value)
  } catch (e) {
    return null
  }

  return localStorage
}
