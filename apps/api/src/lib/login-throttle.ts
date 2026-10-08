// Slows password guessing. Keyed by account email, not IP, so it does not depend on
// proxy-supplied headers. One API instance (SQLite) means memory is enough.
const WINDOW_MS = 15 * 60 * 1000
const MAX_FAILURES = 10
const MAX_TRACKED = 10_000

const failures = new Map<string, { start: number; count: number }>()

function current(key: string, now: number) {
  const entry = failures.get(key)
  if (!entry || now - entry.start > WINDOW_MS) return null
  return entry
}

/** Seconds until the account may try again, or 0 when it is not blocked. */
export function loginRetryAfter(email: string, now = Date.now()) {
  const entry = current(email, now)
  if (!entry || entry.count < MAX_FAILURES) return 0
  return Math.ceil((entry.start + WINDOW_MS - now) / 1000)
}

export function recordLoginFailure(email: string, now = Date.now()) {
  if (failures.size >= MAX_TRACKED) {
    for (const [key, entry] of failures) {
      if (now - entry.start > WINDOW_MS) failures.delete(key)
    }
    // Still full: drop the oldest entry rather than grow without bound.
    if (failures.size >= MAX_TRACKED) failures.delete(failures.keys().next().value!)
  }
  const entry = current(email, now)
  if (entry) entry.count += 1
  else failures.set(email, { start: now, count: 1 })
}

export function clearLoginFailures(email: string) {
  failures.delete(email)
}
