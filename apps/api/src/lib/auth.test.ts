import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { eq } from 'drizzle-orm'
import { migrate } from 'drizzle-orm/libsql/migrator'
import { fileURLToPath } from 'node:url'
import { rm } from 'node:fs/promises'
import { Hono, type Handler } from 'hono'
import * as schema from '../db/schema.js'

const testDirectory = await vi.hoisted(async () => {
  const { mkdtempSync } = await import('node:fs')
  const { tmpdir } = await import('node:os')
  const { join } = await import('node:path')
  return mkdtempSync(join(tmpdir(), 'formulario-auth-test-'))
})

vi.mock('../db/client.js', async () => {
  const { createClient } = await import('@libsql/client')
  const { drizzle } = await import('drizzle-orm/libsql')
  const schema = await import('../db/schema.js')
  const libsql = createClient({ url: `file:${testDirectory}/test.db` })
  return { libsql, db: drizzle(libsql, { schema }) }
})

import { db, libsql } from '../db/client.js'
import { appRoutes, authRoutes } from '../mastra/routes/app-routes.js'
import {
  authenticateUser,
  changePassword,
  createProvisionedUser,
  hashPassword,
  PasswordError,
} from './auth.js'
import { generateTemporaryPassword } from './temporary-password.js'

const migrationsFolder = fileURLToPath(new URL('../../drizzle', import.meta.url))
const passphrase = 'QuietLab9!'
const replacement = 'Notebook9!quiet'

beforeAll(async () => {
  await migrate(db, { migrationsFolder })
  await db.insert(schema.users).values({
    id: 'legacy',
    email: 'legacy@test.local',
    passwordHash: await hashPassword('demo'),
    createdAt: '2026-09-10',
  })
})

afterAll(async () => {
  libsql.close()
  await rm(testDirectory, { recursive: true, force: true })
})

function route(path: string, method: string) {
  const found = [...authRoutes, ...appRoutes].find((entry) => entry.path === path && entry.method === method)
  if (!found || !('handler' in found)) throw new Error(`Missing ${method} ${path}`)
  return found
}

function mount(path: string, method: 'GET' | 'POST') {
  const found = route(path, method)
  const app = new Hono()
  app.on(method, found.path, found.handler as unknown as Handler)
  return app
}

describe('closed registration and provisioned accounts', () => {
  it('keeps an existing short password working and does not ask for a change', async () => {
    await expect(authenticateUser('Legacy@Test.local', 'demo')).resolves.toMatchObject({
      email: 'legacy@test.local',
      mustChangePassword: false,
    })
  })

  it('refuses public registration', async () => {
    const response = await mount('/auth/register', 'POST').request('/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'new@example.com', password: passphrase }),
    })
    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toMatchObject({ code: 'registration_closed' })
    expect(await db.select().from(schema.users).where(eq(schema.users.email, 'new@example.com'))).toHaveLength(0)
  })

  it('asks for a new password before the rest of the app, then accepts a valid password', async () => {
    const temporary = generateTemporaryPassword()
    const email = 'person@example.com'
    await createProvisionedUser(email, temporary, 'paid')

    const login = await mount('/auth/login', 'POST').request('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: temporary }),
    })
    expect(login.status).toBe(200)
    const session = await login.json()
    expect(session.user).toMatchObject({ email, plan: 'paid', mustChangePassword: true })
    const headers = { Authorization: `Bearer ${session.token}`, 'Content-Type': 'application/json' }

    const blocked = await mount('/app/organizations', 'GET').request('/app/organizations', { headers })
    expect(blocked.status).toBe(403)
    await expect(blocked.json()).resolves.toMatchObject({ code: 'password_change_required' })

    const me = await mount('/auth/me', 'GET').request('/auth/me', { headers })
    expect(me.status).toBe(200)

    const passwordApp = mount('/auth/password', 'POST')
    const tooShort = await passwordApp.request('/auth/password', {
      method: 'POST',
      headers,
      body: JSON.stringify({ newPassword: 'short' }),
    })
    expect(tooShort.status).toBe(400)
    await expect(tooShort.json()).resolves.toMatchObject({ code: 'too_short' })

    const same = await passwordApp.request('/auth/password', {
      method: 'POST',
      headers,
      body: JSON.stringify({ newPassword: temporary }),
    })
    expect(same.status).toBe(400)
    await expect(same.json()).resolves.toMatchObject({ code: 'same' })

    const changed = await passwordApp.request('/auth/password', {
      method: 'POST',
      headers,
      body: JSON.stringify({ newPassword: passphrase }),
    })
    expect(changed.status).toBe(200)
    await expect(changed.json()).resolves.toMatchObject({
      user: { mustChangePassword: false },
    })

    const opened = await mount('/app/organizations', 'GET').request('/app/organizations', { headers })
    expect(opened.status).toBe(200)

    const missingCurrent = await passwordApp.request('/auth/password', {
      method: 'POST',
      headers,
      body: JSON.stringify({ newPassword: replacement }),
    })
    expect(missingCurrent.status).toBe(400)
    await expect(missingCurrent.json()).resolves.toMatchObject({ code: 'wrong_current' })

    const updated = await changePassword(
      session.user.id,
      replacement,
      passphrase,
    )
    expect(updated.mustChangePassword).toBe(false)
    await expect(authenticateUser(email, replacement)).resolves.toMatchObject({ email })
    await expect(changePassword(session.user.id, passphrase, 'not-the-password')).rejects.toBeInstanceOf(
      PasswordError,
    )
  })
})
