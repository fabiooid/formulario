import { afterEach, describe, expect, it } from 'vitest'
import { isMastraStudioEnabled, studioPublicOrigin } from './studio-env.js'

const originalStudio = process.env.MASTRA_STUDIO
const originalAppUrl = process.env.APP_PUBLIC_URL

afterEach(() => {
  if (originalStudio === undefined) delete process.env.MASTRA_STUDIO
  else process.env.MASTRA_STUDIO = originalStudio
  if (originalAppUrl === undefined) delete process.env.APP_PUBLIC_URL
  else process.env.APP_PUBLIC_URL = originalAppUrl
})

describe('isMastraStudioEnabled', () => {
  it('accepts 1 and true', () => {
    process.env.MASTRA_STUDIO = '1'
    expect(isMastraStudioEnabled()).toBe(true)
    process.env.MASTRA_STUDIO = 'true'
    expect(isMastraStudioEnabled()).toBe(true)
  })

  it('rejects other values', () => {
    delete process.env.MASTRA_STUDIO
    expect(isMastraStudioEnabled()).toBe(false)
    process.env.MASTRA_STUDIO = '0'
    expect(isMastraStudioEnabled()).toBe(false)
  })
})

describe('studioPublicOrigin', () => {
  it('parses APP_PUBLIC_URL', () => {
    process.env.APP_PUBLIC_URL = 'https://formulari.up.railway.app'
    expect(studioPublicOrigin()).toEqual({
      host: 'formulari.up.railway.app',
      protocol: 'https',
      port: 443,
    })
  })

  it('returns null for a bad URL', () => {
    process.env.APP_PUBLIC_URL = 'not-a-url'
    expect(studioPublicOrigin()).toBeNull()
  })
})
