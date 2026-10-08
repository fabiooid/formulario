import { describe, expect, it } from 'vitest'
import { clearLoginFailures, loginRetryAfter, recordLoginFailure } from './login-throttle.js'

describe('login throttle', () => {
  it('blocks an account after ten failures and lifts after fifteen minutes', () => {
    const email = 'blocked@example.com'
    const start = 1_000_000
    for (let i = 0; i < 9; i++) recordLoginFailure(email, start)
    expect(loginRetryAfter(email, start)).toBe(0)
    recordLoginFailure(email, start)
    expect(loginRetryAfter(email, start)).toBe(15 * 60)
    expect(loginRetryAfter(email, start + 15 * 60 * 1000 + 1)).toBe(0)
  })

  it('forgets failures after a successful sign-in', () => {
    const email = 'cleared@example.com'
    for (let i = 0; i < 10; i++) recordLoginFailure(email)
    clearLoginFailures(email)
    expect(loginRetryAfter(email)).toBe(0)
  })

  it('counts each account separately', () => {
    for (let i = 0; i < 10; i++) recordLoginFailure('one@example.com')
    expect(loginRetryAfter('two@example.com')).toBe(0)
  })
})
