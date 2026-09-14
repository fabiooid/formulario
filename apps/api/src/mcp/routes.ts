import { createHash, randomBytes } from 'node:crypto'
import { Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import { registerApiRoute } from '@mastra/core/server'
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js'
import { and, eq, isNull } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../db/client.js'
import { mcpClients, mcpRequests, mcpGrants } from '../db/schema.js'
import { verifyAppToken } from '../lib/auth.js'
import { getMembership, listOrganizations } from '../services/organizations.js'
import { createMcpServer } from './tools.js'

const hash = (value: string) => createHash('sha256').update(value).digest('base64url')
const secret = () => randomBytes(32).toString('base64url')
export const MCP_SCOPE = 'atelier:read atelier:propose'
export function mcpConfig() {
  const origin = new URL(process.env.MCP_PUBLIC_URL ?? 'http://localhost:4111').origin
  const web = new URL(process.env.APP_PUBLIC_URL ?? 'http://localhost:5173').origin
  if (process.env.NODE_ENV === 'production' && (!origin.startsWith('https:') || !web.startsWith('https:'))) throw new Error('MCP_PUBLIC_URL and APP_PUBLIC_URL must use HTTPS in production')
  return { origin, web, resource: `${origin}/mcp` }
}
const redirectSchema = z.string().url().max(2048).refine(value => {
  const url = new URL(value)
  return !url.hash && !url.username && !url.password && (url.protocol === 'https:' || (url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)))
}, 'Redirects require HTTPS, except loopback development clients')
const authorizeSchema = z.object({
  client_id: z.string(), redirect_uri: redirectSchema, response_type: z.literal('code'),
  code_challenge: z.string().regex(/^[A-Za-z0-9_-]{43}$/), code_challenge_method: z.literal('S256'),
  resource: z.string(), scope: z.string().default(MCP_SCOPE), state: z.string().max(2000).optional(),
})

export const mcpApp = new Hono<{ Variables: { user: { id: string } } }>()
mcpApp.use('*', bodyLimit({ maxSize: 128 * 1024, onError: c => c.json({ error: 'Request too large' }, 413) }))
mcpApp.use('*', async (c, next) => {
  const { origin, web } = mcpConfig()
  // Never trust forwarded Host headers to construct OAuth URLs.
  if (new URL(c.req.url).host !== new URL(origin).host) return c.json({ error: 'Invalid host' }, 421)
  const requestOrigin = c.req.header('origin')
  if (requestOrigin && requestOrigin !== origin && requestOrigin !== web) return c.json({ error: 'Origin not allowed' }, 403)
  c.header('Cache-Control', 'no-store')
  await next()
})
// Bound unauthenticated registration/request growth without trusting proxy-supplied IP headers.
const oauthWindows = new Map<string, { start: number; count: number }>()
mcpApp.use('/oauth/*', async (c, next) => {
  const key = c.req.path === '/oauth/token' ? 'token' : 'oauth'
  const now = Date.now()
  let window = oauthWindows.get(key)
  if (!window || now - window.start > 60_000) { window = { start: now, count: 0 }; oauthWindows.set(key, window) }
  if (++window.count > 120) { c.header('Retry-After', '60'); return c.json({ error: 'temporarily_unavailable' }, 429) }
  await next()
})
mcpApp.onError((error, c) => c.json({ error: error instanceof z.ZodError ? 'invalid_request' : 'Request failed', ...(error instanceof z.ZodError ? { details: error.issues.map(i => i.message) } : {}) }, 400))

mcpApp.get('/.well-known/oauth-protected-resource', c => c.json({ resource: mcpConfig().resource, authorization_servers: [mcpConfig().origin], scopes_supported: MCP_SCOPE.split(' '), bearer_methods_supported: ['header'] }))
mcpApp.get('/.well-known/oauth-protected-resource/mcp', c => c.json({ resource: mcpConfig().resource, authorization_servers: [mcpConfig().origin], scopes_supported: MCP_SCOPE.split(' '), bearer_methods_supported: ['header'] }))
mcpApp.get('/.well-known/oauth-authorization-server', c => {
  const { origin } = mcpConfig()
  return c.json({ issuer: origin, authorization_endpoint: `${origin}/oauth/authorize`, token_endpoint: `${origin}/oauth/token`, registration_endpoint: `${origin}/oauth/register`, revocation_endpoint: `${origin}/oauth/revoke`, response_types_supported: ['code'], grant_types_supported: ['authorization_code', 'refresh_token'], code_challenge_methods_supported: ['S256'], token_endpoint_auth_methods_supported: ['none'], scopes_supported: MCP_SCOPE.split(' ') })
})
// Registration requires explicit user consent later and never grants data access itself.
mcpApp.post('/oauth/register', async c => {
  const input = z.object({ client_name: z.string().trim().min(1).max(100).default('External assistant'), redirect_uris: z.array(redirectSchema).min(1).max(5), token_endpoint_auth_method: z.literal('none').default('none') }).parse(await c.req.json())
  const clientId = crypto.randomUUID()
  await db.insert(mcpClients).values({ id: clientId, name: input.client_name, redirectUris: JSON.stringify(input.redirect_uris), createdAt: Date.now() })
  return c.json({ ...input, client_id: clientId, grant_types: ['authorization_code', 'refresh_token'], response_types: ['code'] }, 201)
})
mcpApp.get('/oauth/authorize', async c => {
  const input = authorizeSchema.parse(c.req.query())
  if (input.resource !== mcpConfig().resource || input.scope.split(' ').sort().join(' ') !== MCP_SCOPE.split(' ').sort().join(' ')) return c.json({ error: 'invalid_scope_or_resource' }, 400)
  const [client] = await db.select().from(mcpClients).where(eq(mcpClients.id, input.client_id)).limit(1)
  if (!client || !JSON.parse(client.redirectUris).includes(input.redirect_uri)) return c.json({ error: 'invalid_client_or_redirect' }, 400)
  const id = secret()
  await db.insert(mcpRequests).values({ id, payload: JSON.stringify(input), expiresAt: Date.now() + 10 * 60_000 })
  return c.redirect(`${mcpConfig().web}/settings/connections?request=${id}`)
})

mcpApp.use('/app/connections*', async (c, next) => {
  const token = c.req.header('authorization')?.replace(/^Bearer /, '')
  const user = token ? await verifyAppToken(token) : null
  if (!user) return c.json({ error: 'Unauthorized' }, 401)
  c.set('user', user)
  await next()
})
mcpApp.get('/app/connections', async c => {
  const user = c.get('user')
  const grants = await db.select({ id: mcpGrants.id, organizationId: mcpGrants.organizationId, clientName: mcpClients.name, createdAt: mcpGrants.createdAt, expiresAt: mcpGrants.expiresAt }).from(mcpGrants).innerJoin(mcpClients, eq(mcpGrants.clientId, mcpClients.id)).where(and(eq(mcpGrants.userId, user.id), isNull(mcpGrants.revokedAt)))
  return c.json({ endpoint: mcpConfig().resource, grants: grants.filter(g => g.expiresAt > Date.now()), organizations: await listOrganizations(user.id) })
})
mcpApp.get('/app/connections/request/:id', async c => {
  const [request] = await db.select().from(mcpRequests).where(eq(mcpRequests.id, c.req.param('id'))).limit(1)
  if (!request || request.expiresAt < Date.now()) return c.json({ error: 'Authorization request expired' }, 404)
  const input = authorizeSchema.parse(JSON.parse(request.payload))
  const [client] = await db.select().from(mcpClients).where(eq(mcpClients.id, input.client_id)).limit(1)
  return c.json({ clientName: client.name, redirectUri: input.redirect_uri, scope: input.scope })
})
mcpApp.post('/app/connections/authorize', async c => {
  const input = z.object({ requestId: z.string(), organizationId: z.string(), allow: z.boolean() }).parse(await c.req.json())
  const user = c.get('user')
  const member = await getMembership(input.organizationId, user.id)
  if (input.allow && (!member || member.role === 'viewer')) return c.json({ error: 'Editor access required' }, 403)
  const outcome = await db.transaction(async tx => {
    const [request] = await tx.select().from(mcpRequests).where(eq(mcpRequests.id, input.requestId)).limit(1)
    if (!request || request.expiresAt < Date.now()) return null
    const auth = authorizeSchema.parse(JSON.parse(request.payload))
    await tx.delete(mcpRequests).where(eq(mcpRequests.id, request.id))
    const redirect = new URL(auth.redirect_uri)
    if (auth.state) redirect.searchParams.set('state', auth.state)
    if (!input.allow) { redirect.searchParams.set('error', 'access_denied'); return redirect.href }
    const code = secret(), now = Date.now()
    await tx.insert(mcpGrants).values({ id: crypto.randomUUID(), clientId: auth.client_id, userId: user.id, organizationId: input.organizationId, codeHash: hash(code), codeExpiresAt: now + 60_000, challenge: auth.code_challenge, redirectUri: auth.redirect_uri, expiresAt: now + 30 * 86400_000, createdAt: now })
    redirect.searchParams.set('code', code)
    return redirect.href
  })
  return outcome ? c.json({ redirect: outcome }) : c.json({ error: 'Authorization request expired or already used' }, 409)
})
mcpApp.post('/app/connections/:id/revoke', async c => {
  await db.update(mcpGrants).set({ revokedAt: Date.now(), accessHash: null, refreshHash: null, codeHash: null }).where(and(eq(mcpGrants.id, c.req.param('id')), eq(mcpGrants.userId, c.get('user').id)))
  return c.json({ revoked: true })
})
mcpApp.post('/oauth/token', async c => {
  const input = z.object({ grant_type: z.enum(['authorization_code', 'refresh_token']), client_id: z.string(), resource: z.string(), code: z.string().optional(), code_verifier: z.string().regex(/^[A-Za-z0-9._~-]{43,128}$/).optional(), redirect_uri: z.string().optional(), refresh_token: z.string().optional() }).parse(await c.req.parseBody())
  if (input.resource !== mcpConfig().resource) return c.json({ error: 'invalid_target' }, 400)
  const tokens = await db.transaction(async tx => {
    const key = input.grant_type === 'authorization_code' ? input.code : input.refresh_token
    if (!key) return null
    const [grant] = await tx.select().from(mcpGrants).where(and(eq(input.grant_type === 'authorization_code' ? mcpGrants.codeHash : mcpGrants.refreshHash, hash(key)), eq(mcpGrants.clientId, input.client_id), isNull(mcpGrants.revokedAt))).limit(1)
    const now = Date.now()
    if (!grant || grant.expiresAt <= now) return null
    if (input.grant_type === 'authorization_code' && (grant.codeExpiresAt <= now || input.redirect_uri !== grant.redirectUri || !input.code_verifier || hash(input.code_verifier) !== grant.challenge)) return null
    const access = secret(), refresh = secret()
    await tx.update(mcpGrants).set({ codeHash: null, accessHash: hash(access), accessExpiresAt: now + 3600_000, refreshHash: hash(refresh) }).where(eq(mcpGrants.id, grant.id))
    return { access_token: access, refresh_token: refresh, token_type: 'Bearer', expires_in: 3600, scope: MCP_SCOPE }
  })
  return tokens ? c.json(tokens) : c.json({ error: 'invalid_grant' }, 400)
})
mcpApp.post('/oauth/revoke', async c => {
  const input = z.object({ token: z.string(), client_id: z.string() }).parse(await c.req.parseBody())
  for (const column of [mcpGrants.accessHash, mcpGrants.refreshHash]) await db.update(mcpGrants).set({ revokedAt: Date.now(), codeHash: null }).where(and(eq(column, hash(input.token)), eq(mcpGrants.clientId, input.client_id)))
  return c.json({})
})
mcpApp.all('/mcp', async c => {
  const bearer = c.req.header('authorization')
  const [grant] = bearer?.startsWith('Bearer ') ? await db.select().from(mcpGrants).where(and(eq(mcpGrants.accessHash, hash(bearer.slice(7))), isNull(mcpGrants.revokedAt))).limit(1) : []
  if (!grant || !grant.accessExpiresAt || grant.accessExpiresAt <= Date.now() || grant.expiresAt <= Date.now() || !await getMembership(grant.organizationId, grant.userId)) {
    c.header('WWW-Authenticate', `Bearer resource_metadata="${mcpConfig().origin}/.well-known/oauth-protected-resource", scope="${MCP_SCOPE}"`)
    return c.json({ error: 'Unauthorized' }, 401)
  }
  const server = createMcpServer({ userId: grant.userId, organizationId: grant.organizationId })
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true })
  await server.connect(transport)
  try { return await transport.handleRequest(c.req.raw) } finally { await server.close() }
})

export const mcpRoutes = [
  ...['/.well-known/oauth-protected-resource', '/.well-known/oauth-protected-resource/mcp', '/.well-known/oauth-authorization-server', '/oauth/authorize', '/app/connections', '/app/connections/request/:id'].map(path => registerApiRoute(path, { method: 'GET', requiresAuth: false, handler: c => mcpApp.fetch(c.req.raw) })),
  ...['/oauth/register', '/oauth/token', '/oauth/revoke', '/app/connections/authorize', '/app/connections/:id/revoke'].map(path => registerApiRoute(path, { method: 'POST', requiresAuth: false, handler: c => mcpApp.fetch(c.req.raw) })),
  ...(['GET', 'POST', 'DELETE'] as const).map(method => registerApiRoute('/mcp', { method, requiresAuth: false, handler: c => mcpApp.fetch(c.req.raw) })),
]
