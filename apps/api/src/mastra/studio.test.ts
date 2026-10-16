import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SignJWT } from 'jose'
import { MastraJwtAuth } from '@mastra/auth'
import {
  assertStudioEnv,
  createStudioApiMiddleware,
  createStudioConfig,
  getBearerToken,
  studioBasePath,
  studioServerHints,
  verifyStudioToken,
} from './studio.js'

const studioSecret = 'studio-secret-for-tests-only-not-the-app-secret'
const appSecret = 'formulario-login-secret-for-tests'

async function signToken(secret: string, sub = 'fabio') {
  return new SignJWT({ sub })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(sub)
    .setIssuedAt()
    .setExpirationTime('2h')
    .sign(new TextEncoder().encode(secret))
}

function context(input: { method?: string; path: string; authorization?: string }) {
  return {
    req: {
      method: input.method ?? 'GET',
      path: input.path,
      header: (name: string) => {
        if (name.toLowerCase() === 'authorization') return input.authorization
        return undefined
      },
    },
    json: (body: unknown, status?: number) =>
      new Response(JSON.stringify(body), {
        status: status ?? 200,
        headers: { 'Content-Type': 'application/json' },
      }),
  }
}

async function readJson(response: Response | void) {
  if (!response) return null
  return { status: response.status, body: await response.json() }
}

function clearStudioEnv() {
  delete process.env.MASTRA_STUDIO
  delete process.env.MASTRA_STUDIO_JWT_SECRET
  delete process.env.MASTRA_STUDIO_BASE_PATH
  delete process.env.MASTRA_JWT_SECRET
  delete process.env.APP_PUBLIC_URL
  process.env.NODE_ENV = 'test'
}

describe('studio config', () => {
  beforeEach(clearStudioEnv)
  afterEach(clearStudioEnv)

  it('keeps Studio off until the Studio secret is set', () => {
    expect(createStudioConfig()).toBeUndefined()
  })

  it('uses studio.auth with MastraJwtAuth when the Studio secret is set', () => {
    process.env.MASTRA_STUDIO_JWT_SECRET = studioSecret
    const config = createStudioConfig()
    expect(config?.auth).toBeDefined()
    expect(config?.auth).toBeInstanceOf(MastraJwtAuth)
    expect(config?.auth).toMatchObject({ isSimpleAuth: true })
  })

  it('serves Studio under /studio unless MASTRA_STUDIO_BASE_PATH is set', () => {
    expect(studioBasePath()).toBe('/studio')
    process.env.MASTRA_STUDIO_BASE_PATH = '/observability'
    expect(studioBasePath()).toBe('/observability')
  })

  it('reads public host hints from APP_PUBLIC_URL', () => {
    process.env.APP_PUBLIC_URL = 'https://formulari.up.railway.app'
    expect(studioServerHints()).toMatchObject({
      studioBase: '/studio',
      studioHost: 'formulari.up.railway.app',
      studioProtocol: 'https',
      studioPort: 443,
    })
  })

  it('refuses the old MASTRA_STUDIO open gate in production', () => {
    process.env.NODE_ENV = 'production'
    process.env.MASTRA_STUDIO = '1'
    expect(() => assertStudioEnv()).toThrow(/MASTRA_STUDIO/)
  })

  it('refuses to reuse the Formulario login secret in production', () => {
    process.env.NODE_ENV = 'production'
    process.env.MASTRA_JWT_SECRET = appSecret
    process.env.MASTRA_STUDIO_JWT_SECRET = appSecret
    expect(() => assertStudioEnv()).toThrow(/must not reuse/)
  })
})

describe('studio tokens', () => {
  beforeEach(clearStudioEnv)
  afterEach(clearStudioEnv)

  it('reads a Bearer token from the Authorization header', () => {
    expect(getBearerToken('Bearer abc.def')).toBe('abc.def')
    expect(getBearerToken('bearer abc.def')).toBe('abc.def')
    expect(getBearerToken('Basic abc')).toBeNull()
    expect(getBearerToken(undefined)).toBeNull()
  })

  it('accepts a Studio JWT and rejects a Formulario login JWT', async () => {
    process.env.MASTRA_STUDIO_JWT_SECRET = studioSecret
    const studioToken = await signToken(studioSecret)
    const appToken = await signToken(appSecret)
    await expect(verifyStudioToken(studioToken)).resolves.toBe(true)
    await expect(verifyStudioToken(appToken)).resolves.toBe(false)

    const user = await createStudioConfig()?.auth.getCurrentUser(
      new Request('http://localhost/api/auth/capabilities', {
        headers: { Authorization: `Bearer ${studioToken}` },
      }),
    )
    expect(user).toMatchObject({ id: 'fabio' })
  })
})

describe('studio API gate', () => {
  beforeEach(clearStudioEnv)
  afterEach(clearStudioEnv)

  it('hides generic /api routes when Studio auth is off', async () => {
    const agentGate = vi.fn()
    const next = vi.fn()
    const middleware = createStudioApiMiddleware(agentGate)
    const response = await middleware(context({ path: '/api/agents' }), next)
    expect(await readJson(response)).toMatchObject({ status: 404, body: { error: 'Not found' } })
    expect(next).not.toHaveBeenCalled()
    expect(agentGate).not.toHaveBeenCalled()
  })

  it('requires a Studio JWT for /api when the Studio secret is set', async () => {
    process.env.MASTRA_STUDIO_JWT_SECRET = studioSecret
    const agentGate = vi.fn()
    const next = vi.fn()
    const middleware = createStudioApiMiddleware(agentGate)

    const missing = await middleware(context({ path: '/api/agents' }), next)
    expect(await readJson(missing)).toMatchObject({ status: 401, body: { error: 'Unauthorized' } })

    const appToken = await signToken(appSecret)
    const wrong = await middleware(
      context({ path: '/api/agents', authorization: `Bearer ${appToken}` }),
      next,
    )
    expect(await readJson(wrong)).toMatchObject({ status: 401, body: { error: 'Unauthorized' } })

    const studioToken = await signToken(studioSecret)
    await middleware(
      context({ path: '/api/agents', authorization: `Bearer ${studioToken}` }),
      next,
    )
    expect(next).toHaveBeenCalledOnce()
    expect(agentGate).not.toHaveBeenCalled()
  })

  it('keeps the Lab Assistant stream on Formulario login auth', async () => {
    process.env.MASTRA_STUDIO_JWT_SECRET = studioSecret
    const agentGate = vi.fn(async (_c, next) => next())
    const next = vi.fn()
    const middleware = createStudioApiMiddleware(agentGate)
    const appToken = await signToken(appSecret)
    await middleware(
      context({
        method: 'POST',
        path: '/api/agents/assistantAgent/stream',
        authorization: `Bearer ${appToken}`,
      }),
      next,
    )
    expect(agentGate).toHaveBeenCalledOnce()
  })

  it('lets a valid Studio JWT through the assistant stream without opening unauthenticated access', async () => {
    process.env.MASTRA_STUDIO_JWT_SECRET = studioSecret
    const agentGate = vi.fn()
    const next = vi.fn()
    const middleware = createStudioApiMiddleware(agentGate)

    const missing = await middleware(
      context({ method: 'POST', path: '/api/agents/assistantAgent/stream' }),
      next,
    )
    expect(missing).toBeUndefined()
    expect(agentGate).toHaveBeenCalledOnce()
    expect(next).not.toHaveBeenCalled()

    agentGate.mockClear()
    const studioToken = await signToken(studioSecret)
    await middleware(
      context({
        method: 'POST',
        path: '/api/agents/assistantAgent/stream',
        authorization: `Bearer ${studioToken}`,
      }),
      next,
    )
    expect(next).toHaveBeenCalledOnce()
    expect(agentGate).not.toHaveBeenCalled()
  })
})
