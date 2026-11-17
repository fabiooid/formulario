import { describe, expect, it } from 'vitest'
import { isWebStaticReservedPath } from './web-static.js'

describe('web static reserved paths', () => {
  it('does not swallow Studio under /studio', () => {
    expect(isWebStaticReservedPath('/studio')).toBe(true)
    expect(isWebStaticReservedPath('/studio/')).toBe(true)
    expect(isWebStaticReservedPath('/studio/assets/index.js')).toBe(true)
  })

  it('still leaves Formulario client routes to the app shell', () => {
    expect(isWebStaticReservedPath('/')).toBe(false)
    expect(isWebStaticReservedPath('/products/123')).toBe(false)
    expect(isWebStaticReservedPath('/settings/account')).toBe(false)
  })

  it('still keeps API prefixes off the SPA fallback', () => {
    expect(isWebStaticReservedPath('/api/agents')).toBe(true)
    expect(isWebStaticReservedPath('/auth/me')).toBe(true)
    expect(isWebStaticReservedPath('/app/products')).toBe(true)
    expect(isWebStaticReservedPath('/mcp')).toBe(true)
    expect(isWebStaticReservedPath('/healthz')).toBe(true)
  })
})
