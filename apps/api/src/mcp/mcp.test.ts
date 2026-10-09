import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { migrate } from 'drizzle-orm/libsql/migrator'
import { eq } from 'drizzle-orm'
import { rm } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import * as schema from '../db/schema.js'
const directory = await vi.hoisted(async () => {
  const { mkdtempSync } = await import('node:fs')
  const { tmpdir } = await import('node:os')
  return mkdtempSync(`${tmpdir()}/formulario-mcp-`)
})
vi.mock('../db/client.js', async () => {
  const { createClient } = await import('@libsql/client')
  const { drizzle } = await import('drizzle-orm/libsql')
  const schema = await import('../db/schema.js')
  const libsql = createClient({ url: `file:${directory}/test.db` })
  return { libsql, db: drizzle(libsql, { schema }) }
})
import { db, libsql } from '../db/client.js'
import { mcpApp, MCP_SCOPE } from './routes.js'
import { createProductViaMcp, submitFormula, scopedWorkspace } from './tools.js'
import { signAppToken } from '../lib/auth.js'
import { createProduct, getWorkspace, resolvePatch, commitNewVersion } from '../services/products.js'
let appToken: string
const origin = 'http://localhost:4111'
const verifier = 'a'.repeat(43)
const principal = { userId: 'owner', organizationId: 'org' }
beforeAll(async () => {
  await migrate(db, { migrationsFolder: fileURLToPath(new URL('../../drizzle', import.meta.url)) })
  await db.insert(schema.users).values(['owner', 'outsider', 'viewer'].map(id => ({ id, email: `${id}@test.local`, passwordHash: 'test', createdAt: 'today' })))
  await db.insert(schema.organizations).values([{ id: 'org', name: 'Lab', kind: 'personal', createdAt: 'today' }, { id: 'other', name: 'Other', createdAt: 'today' }])
  await db.insert(schema.organizationMembers).values([{ id: 'one', organizationId: 'org', userId: 'owner', role: 'owner', createdAt: 'today' }, { id: 'two', organizationId: 'org', userId: 'viewer', role: 'viewer', createdAt: 'today' }, { id: 'three', organizationId: 'other', userId: 'owner', role: 'owner', createdAt: 'today' }])
  await db.update(schema.users).set({ activeOrganizationId: 'org' }).where(eq(schema.users.id, 'owner'))
  appToken = await signAppToken({ id: 'owner', email: 'owner@test.local', plan: 'free' })
})
afterAll(async () => { libsql.close(); await rm(directory, { recursive: true, force: true }) })
const jsonPost = (path: string, body: unknown, token?: string) => mcpApp.request(origin + path, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) })
async function connection() {
  const client = await (await jsonPost('/oauth/register', { client_name: 'Test assistant', redirect_uris: ['https://client.example/callback'] })).json()
  const query = new URLSearchParams({ client_id: client.client_id, redirect_uri: 'https://client.example/callback', response_type: 'code', code_challenge: createHash('sha256').update(verifier).digest('base64url'), code_challenge_method: 'S256', resource: origin + '/mcp', scope: MCP_SCOPE, state: 'test-state' })
  const start = await mcpApp.request(origin + '/oauth/authorize?' + query)
  expect(start.status).toBe(302)
  const requestId = new URL(start.headers.get('location')!).searchParams.get('request')!
  return { client, requestId, query }
}
async function exchange(clientId: string, code: string, proof = verifier) {
  return mcpApp.request(origin + '/oauth/token', { method: 'POST', body: new URLSearchParams({ grant_type: 'authorization_code', client_id: clientId, code, code_verifier: proof, redirect_uri: 'https://client.example/callback', resource: origin + '/mcp' }) })
}
async function authorized() {
  const { client, requestId } = await connection()
  const approved = await (await jsonPost('/app/connections/authorize', { requestId, organizationId: 'org', allow: true }, appToken)).json()
  expect(new URL(approved.redirect).searchParams.get('state')).toBe('test-state')
  const code = new URL(approved.redirect).searchParams.get('code')!
  const tokens = await (await exchange(client.client_id, code)).json()
  return { client, tokens, code }
}
async function rpc(token: string, method: string, params: unknown = {}) {
  return mcpApp.request(origin + '/mcp', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', 'MCP-Protocol-Version': '2025-11-25' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) })
}
async function fixture() {
  const product = await createProduct({ userId: 'owner', name: 'MCP trial', type: 'perfume', markets: ['EU'], brief: 'Dry woods' })
  const empty = (await getWorkspace(product.id, 'owner'))!.variants[0]
  await db.insert(schema.formulaRows).values({ id: crypto.randomUUID(), versionId: empty.version!.id, inci: 'Squalane', percent: 100, function: 'carrier', phase: 'base', sortOrder: 0 })
  const w = (await getWorkspace(product.id, 'owner'))!
  return { productId: product.id, variantId: w.variants[0].variant.id, baseVersionId: w.variants[0].version!.id, summary: 'External trial', rows: [{ inci: 'Squalane', percent: 90, function: 'carrier', phase: 'base' }, { inci: 'Iso E Super', percent: 10, function: 'wood', phase: 'base' }] }
}

describe('OAuth and MCP transport', () => {
  it('challenges unauthenticated calls and blocks wrong hosts and origins', async () => {
    const noAuth = await mcpApp.request(origin + '/mcp')
    expect(noAuth.status).toBe(401)
    expect(noAuth.headers.get('www-authenticate')).toContain('oauth-protected-resource')
    expect((await mcpApp.request('http://evil.example/mcp')).status).toBe(421)
    expect((await mcpApp.request(origin + '/mcp', { headers: { Origin: 'https://evil.example' } })).status).toBe(403)
  })
  it('keeps app sessions separate from MCP tokens and allows denial without a workspace', async () => {
    expect((await rpc(appToken, 'tools/list')).status).toBe(401)
    const { requestId } = await connection()
    const denied = await (await jsonPost('/app/connections/authorize', { requestId, organizationId: '', allow: false }, appToken)).json()
    expect(new URL(denied.redirect).searchParams.get('error')).toBe('access_denied')
    const { tokens } = await authorized()
    expect((await mcpApp.request(origin + '/app/connections', { headers: { Authorization: `Bearer ${tokens.access_token}` } })).status).toBe(401)
  })
  it('requires consent, exact redirects, correct resource and PKCE; codes are single use', async () => {
    const { client, requestId, query } = await connection()
    expect((await jsonPost('/app/connections/authorize', { requestId, organizationId: 'org', allow: true })).status).toBe(401)
    query.set('redirect_uri', 'https://evil.example/callback')
    expect((await mcpApp.request(origin + '/oauth/authorize?' + query)).status).toBe(400)
    const approved = await (await jsonPost('/app/connections/authorize', { requestId, organizationId: 'org', allow: true }, appToken)).json()
    const code = new URL(approved.redirect).searchParams.get('code')!
    expect((await exchange(client.client_id, code, 'b'.repeat(43))).status).toBe(400)
    expect((await exchange(client.client_id, code)).status).toBe(200)
    expect((await exchange(client.client_id, code)).status).toBe(400)
    expect((await jsonPost('/app/connections/authorize', { requestId, organizationId: 'org', allow: true }, appToken)).status).toBe(409)
  })
  it('initializes, lists controlled tools, reads context, proposes and accepts in Formulario', async () => {
    const { tokens } = await authorized()
    expect((await rpc(tokens.access_token, 'initialize', { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'Test', version: '1' } })).status).toBe(200)
    const listed = await (await rpc(tokens.access_token, 'tools/list')).json()
    expect(listed.result.tools.map((t: { name: string }) => t.name)).toEqual(['list_products', 'create_product', 'read_product', 'read_history', 'submit_formula_proposal'])
    const created = await (await rpc(tokens.access_token, 'tools/call', { name: 'create_product', arguments: { name: 'MCP created', type: 'perfume', brief: 'Cedar opening', claims: ['vegan'] } })).json()
    const createdBody = JSON.parse(created.result.content[0].text)
    expect(createdBody.product.name).toBe('MCP created')
    expect(createdBody.variant.baseVersionId).toBeTruthy()
    expect((await getWorkspace(createdBody.product.id, 'owner'))!.variants[0].rows).toEqual([])
    const input = await fixture()
    const before = await (await rpc(tokens.access_token, 'tools/call', { name: 'read_product', arguments: { productId: input.productId } })).json()
    expect(JSON.parse(before.result.content[0].text).variants[0].version.id).toBe(input.baseVersionId)
    const proposed = await (await rpc(tokens.access_token, 'tools/call', { name: 'submit_formula_proposal', arguments: input })).json()
    const pending = JSON.parse(proposed.result.content[0].text)
    expect(pending.status).toBe('pending')
    const retry = await (await rpc(tokens.access_token, 'tools/call', { name: 'submit_formula_proposal', arguments: input })).json()
    expect(JSON.parse(retry.result.content[0].text).patchId).toBe(pending.patchId)
    expect((await getWorkspace(input.productId, 'owner'))!.variants[0].version!.id).toBe(input.baseVersionId)
    await resolvePatch(pending.patchId, input.productId, 'owner', 'accepted')
    expect((await getWorkspace(input.productId, 'owner'))!.variants[0].rows.map(r => r.percent)).toEqual([90, 10])
  })
  it('expires tokens and checks membership on every request', async () => {
    const { tokens } = await authorized()
    await db.update(schema.organizationMembers).set({ userId: 'outsider' }).where(eq(schema.organizationMembers.id, 'one'))
    expect((await rpc(tokens.access_token, 'tools/list')).status).toBe(401)
    await db.update(schema.organizationMembers).set({ userId: 'owner' }).where(eq(schema.organizationMembers.id, 'one'))
    const tokenHash = createHash('sha256').update(tokens.access_token).digest('base64url')
    await db.update(schema.mcpGrants).set({ accessExpiresAt: Date.now() - 1 }).where(eq(schema.mcpGrants.accessHash, tokenHash))
    expect((await rpc(tokens.access_token, 'tools/list')).status).toBe(401)
  })
  it('rotates refresh tokens, invalidates old tokens and revokes the connection', async () => {
    const { client, tokens } = await authorized()
    const refresh = () => mcpApp.request(origin + '/oauth/token', { method: 'POST', body: new URLSearchParams({ grant_type: 'refresh_token', client_id: client.client_id, refresh_token: tokens.refresh_token, resource: origin + '/mcp' }) })
    const rotated = await (await refresh()).json()
    expect(rotated.access_token).toBeTruthy()
    expect((await refresh()).status).toBe(400)
    expect((await rpc(tokens.access_token, 'tools/list')).status).toBe(401)
    await mcpApp.request(origin + '/oauth/revoke', { method: 'POST', body: new URLSearchParams({ token: rotated.access_token, client_id: client.client_id }) })
    expect((await rpc(rotated.access_token, 'tools/list')).status).toBe(401)
  })
})
describe('proposal isolation and validation', () => {
  it('rejects wrong workspace, removed membership and viewer writes', async () => {
    const input = await fixture()
    await expect(scopedWorkspace({ userId: 'owner', organizationId: 'other' }, input.productId)).rejects.toThrow('not found')
    await expect(scopedWorkspace({ userId: 'outsider', organizationId: 'org' }, input.productId)).rejects.toThrow('access')
    await expect(submitFormula({ userId: 'viewer', organizationId: 'org' }, input)).rejects.toThrow('read-only')
    await expect(createProductViaMcp({ userId: 'viewer', organizationId: 'org' }, { name: 'Blocked' })).rejects.toThrow('read-only')
  })
  it('creates products in the pinned workspace even when the app active org differs', async () => {
    await db.update(schema.users).set({ activeOrganizationId: 'other' }).where(eq(schema.users.id, 'owner'))
    const created = await createProductViaMcp(principal, { name: 'Pinned org product', type: 'skincare', brief: '' })
    expect(created.product.id).toBeTruthy()
    expect(created.variant.label).toBe('Main')
    const [row] = await db.select().from(schema.products).where(eq(schema.products.id, created.product.id)).limit(1)
    expect(row.organizationId).toBe('org')
    await db.update(schema.users).set({ activeOrganizationId: 'org' }).where(eq(schema.users.id, 'owner'))
  })
  it('rejects bad totals, row IDs and stale proposals at submission and acceptance', async () => {
    const input = await fixture()
    await expect(submitFormula(principal, { ...input, rows: [input.rows[0]] })).rejects.toThrow('total')
    await expect(submitFormula(principal, { ...input, rows: input.rows.map(r => ({ ...r, id: 'foreign' })) })).rejects.toThrow('Row IDs')
    const pending = await submitFormula(principal, input)
    const w = (await getWorkspace(input.productId, 'owner'))!
    await commitNewVersion(input.productId, input.variantId, 'owner', w.variants[0].rows.map(r => ({ ...r, notes: 'changed' })), input.baseVersionId)
    await expect(submitFormula(principal, input)).rejects.toThrow('version')
    await expect(resolvePatch(pending.patchId, input.productId, 'owner', 'accepted')).rejects.toMatchObject({ status: 409 })
  })
})
