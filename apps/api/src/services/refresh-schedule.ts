import { refreshOfficialLists } from './official-refresh.js'

// Runs the official-list refresh once a day inside the API process. A separate cron
// service could not reach the database: the volume belongs to this service only.
const RUN_AT_UTC_HOUR = 3

export function msUntilNextRun(now: Date) {
  const next = new Date(now)
  next.setUTCHours(RUN_AT_UTC_HOUR, 0, 0, 0)
  if (next <= now) next.setUTCDate(next.getUTCDate() + 1)
  return next.getTime() - now.getTime()
}

// Healthchecks.io-style dead-man switch: the base URL on success, /fail on failure.
// A missed ping (process down, timer stuck) alerts on its own.
async function ping(failed: boolean) {
  const url = process.env.REFRESH_HEARTBEAT_URL
  if (!url) return
  try {
    await fetch(failed ? `${url.replace(/\/$/, '')}/fail` : url, { signal: AbortSignal.timeout(10_000) })
  } catch (error) {
    console.error('[formulario] Refresh heartbeat ping failed.', error)
  }
}

let running = false

async function runOnce() {
  if (running) return
  running = true
  try {
    const failures = await refreshOfficialLists()
    await ping(failures.length > 0)
  } catch (error) {
    console.error('[formulario] Official list refresh crashed.', error)
    await ping(true)
  } finally {
    running = false
  }
}

export function startRefreshSchedule() {
  const scheduleNext = () => {
    const timer = setTimeout(async () => {
      await runOnce()
      scheduleNext()
    }, msUntilNextRun(new Date()))
    timer.unref()
  }
  scheduleNext()
  console.log(`[formulario] Official lists refresh daily at ${String(RUN_AT_UTC_HOUR).padStart(2, '0')}:00 UTC.`)
}
