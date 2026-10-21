// ---------------------------------------------------------------------------
// Thin localStorage JSON wrapper. This is the only file that touches
// `window.localStorage` directly — every repository goes through it, so
// swapping the persistence backend later (e.g. for Supabase) means writing
// new repository implementations against the same interfaces, not touching
// call sites across the app. See services/index.ts.
// ---------------------------------------------------------------------------

const PREFIX = 'das-estimator:'

export function readKey<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key)
    if (raw === null) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

export function writeKey<T>(key: string, value: T): void {
  localStorage.setItem(PREFIX + key, JSON.stringify(value))
}

export function hasKey(key: string): boolean {
  return localStorage.getItem(PREFIX + key) !== null
}

export function removeKey(key: string): void {
  localStorage.removeItem(PREFIX + key)
}

export function generateId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`
}
