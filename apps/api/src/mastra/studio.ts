import { MastraJwtAuth } from '@mastra/auth'
import { jwtVerify } from 'jose'

export const STUDIO_BASE_PATH = '/studio'
export const ASSISTANT_STREAM_PATH = '/api/agents/assistantAgent/stream'

type GateContext = {
  req: {
    method: string
    path: string
    header: (name: string) => string | undefined
  }
  json: (body: unknown, status?: number) => Response
}

export function studioJwtSecret() {
  const value = process.env.MASTRA_STUDIO_JWT_SECRET?.trim()
  return value || undefined
}

export function isStudioAuthEnabled() {
  return Boolean(studioJwtSecret())
}

export function studioBasePath() {
  const value = process.env.MASTRA_STUDIO_BASE_PATH?.trim()
  return value || STUDIO_BASE_PATH
}

function isOpenStudioGateFlag(value: string | undefined) {
  return value === '1' || value === 'true'
}

export function assertStudioEnv() {
  if (isOpenStudioGateFlag(process.env.MASTRA_STUDIO)) {
    const message =
      'MASTRA_STUDIO is set. That flag used to leave /api open without Authorization. Use MASTRA_STUDIO_JWT_SECRET instead, and never set MASTRA_STUDIO in production.'
    if (process.env.NODE_ENV === 'production') throw new Error(message)
    console.warn(`[formulario] ${message}`)
  }

  const studioSecret = studioJwtSecret()
  const appSecret = process.env.MASTRA_JWT_SECRET?.trim()
  if (studioSecret && appSecret && studioSecret === appSecret) {
    const message =
      'MASTRA_STUDIO_JWT_SECRET must not reuse MASTRA_JWT_SECRET. The app secret signs Formulario login tokens.'
    if (process.env.NODE_ENV === 'production') throw new Error(message)
    console.warn(`[formulario] ${message}`)
  }
}

export function createStudioConfig() {
  const secret = studioJwtSecret()
  if (!secret) return undefined
  return {
    auth: new MastraJwtAuth({ secret }),
  }
}

export function studioServerHints() {
  const publicUrl = process.env.APP_PUBLIC_URL?.trim()
  if (!publicUrl) {
    return {
      studioBase: studioBasePath(),
    }
  }
  try {
    const url = new URL(publicUrl)
    const protocol = url.protocol === 'https:' ? 'https' : 'http'
    const port = url.port ? Number(url.port) : protocol === 'https' ? 443 : 80
    return {
      studioBase: studioBasePath(),
      studioHost: url.hostname,
      studioProtocol: protocol as 'http' | 'https',
      studioPort: port,
    }
  } catch {
    return {
      studioBase: studioBasePath(),
    }
  }
}

export function getBearerToken(authorization: string | undefined) {
  if (!authorization?.toLowerCase().startsWith('bearer ')) return null
  const token = authorization.slice(7).trim()
  return token || null
}

export async function verifyStudioToken(token: string) {
  const secret = studioJwtSecret()
  if (!secret) return false
  try {
    await jwtVerify(token, new TextEncoder().encode(secret))
    return true
  } catch {
    return false
  }
}

export function createStudioApiMiddleware(agentGate: (c: never, next: () => Promise<void>) => Promise<void | Response>) {
  return async function studioApiMiddleware(c: GateContext, next: () => Promise<void>): Promise<void | Response> {
    if (c.req.method === 'OPTIONS') return next()

    const studioEnabled = isStudioAuthEnabled()
    const isAssistantStream = c.req.path === ASSISTANT_STREAM_PATH
    const token = getBearerToken(c.req.header('authorization'))

    if (isAssistantStream) {
      if (studioEnabled && token && (await verifyStudioToken(token))) return next()
      return agentGate(c as never, next)
    }

    if (!studioEnabled) return c.json({ error: 'Not found' }, 404)
    if (!token) return c.json({ error: 'Unauthorized' }, 401)
    if (!(await verifyStudioToken(token))) return c.json({ error: 'Unauthorized' }, 401)
    return next()
  }
}
