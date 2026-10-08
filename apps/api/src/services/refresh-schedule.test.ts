import { describe, expect, it } from 'vitest'
import { msUntilNextRun } from './refresh-schedule.js'

const HOUR = 60 * 60 * 1000

describe('msUntilNextRun', () => {
  it('waits until 03:00 UTC the same day when it is earlier', () => {
    expect(msUntilNextRun(new Date('2026-10-08T01:00:00Z'))).toBe(2 * HOUR)
  })

  it('waits until 03:00 UTC the next day when it is later', () => {
    expect(msUntilNextRun(new Date('2026-10-08T04:00:00Z'))).toBe(23 * HOUR)
  })

  it('never schedules a run for right now', () => {
    expect(msUntilNextRun(new Date('2026-10-08T03:00:00Z'))).toBe(24 * HOUR)
  })
})
