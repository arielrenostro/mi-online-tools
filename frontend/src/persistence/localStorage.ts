export function lsSet<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    console.warn('[miot] localStorage write failed:', key)
  }
}

export function lsGet<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

export function lsClear(key: string): void {
  try {
    localStorage.removeItem(key)
  } catch { /* ignore */ }
}
