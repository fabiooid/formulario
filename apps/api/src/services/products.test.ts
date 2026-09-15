import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { createClient } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import { migrate } from 'drizzle-orm/libsql/migrator'
import { eq } from 'drizzle-orm'
import { readFile, rm } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { Hono, type Handler } from 'hono'
import * as schema from '../db/schema.js'

const testDirectory = await vi.hoisted(async () => {
  const { mkdtempSync } = await import('node:fs')
  const { tmpdir } = await import('node:os')
  const { join } = await import('node:path')
  return mkdtempSync(join(tmpdir(), 'formulario-products-test-'))
})

vi.mock('../db/client.js', async () => {
  const { createClient } = await import('@libsql/client')
  const { drizzle } = await import('drizzle-orm/libsql')
  const schema = await import('../db/schema.js')
  const libsql = createClient({ url: `file:${testDirectory}/test.db` })
  return { libsql, db: drizzle(libsql, { schema }) }
})

import { db, libsql } from '../db/client.js'
import { appRoutes } from '../mastra/routes/app-routes.js'
import { signAppToken } from '../lib/auth.js'
import {
  commitNewVersion,
  createPatch,
  createProduct,
  createVariant,
  deleteProduct,
  duplicateProduct,
  getCurrentVersionForVariant,
  getFormulaRows,
  getProductForUser,
  getWorkspace,
  listPatches,
  listProducts,
  resolvePatch,
  setProductArchived,
  setProductPinned,
  updateFormulaRowLock,
} from './products.js'

const migrationsFolder = fileURLToPath(new URL('../../drizzle', import.meta.url))

beforeAll(async () => {
  await migrate(db, { migrationsFolder })
  for (const id of ['owner', 'outsider', 'viewer']) {
    await db
      .insert(schema.users)
      .values({ id, email: `${id}@test.local`, passwordHash: 'test', createdAt: '2026-09-10' })
  }
  await db
    .insert(schema.organizations)
    .values({ id: 'org', name: 'Lab', kind: 'personal', createdAt: '2026-09-10' })
  await db.insert(schema.organizationMembers).values([
    {
      id: 'member-owner',
      organizationId: 'org',
      userId: 'owner',
      role: 'owner',
      createdAt: '2026-09-10',
    },
    {
      id: 'member-viewer',
      organizationId: 'org',
      userId: 'viewer',
      role: 'viewer',
      createdAt: '2026-09-10',
    },
  ])
  await db
    .update(schema.users)
    .set({ activeOrganizationId: 'org' })
    .where(eq(schema.users.id, 'owner'))
})

afterAll(async () => {
  libsql.close()
  await rm(testDirectory, { recursive: true, force: true })
})

async function fixture(userId = 'owner') {
  const product = await createProduct({
    userId,
    name: 'Face oil',
    type: 'skincare',
    markets: ['EU'],
    brief: 'Oil',
    formula: [{ inci: 'Squalane', percent: 100, phase: 'A', function: 'emollient' }],
  })
  const workspace = (await getWorkspace(product.id, userId))!
  const variant = workspace.variants[0]
  return {
    productId: product.id,
    variantId: variant.variant.id,
    versionId: variant.version!.id,
    rows: variant.rows,
  }
}

describe('formula version persistence', () => {
  it('saves the same row IDs repeatedly while preserving every earlier version', async () => {
    const f = await fixture()
    const v2 = await commitNewVersion(
      f.productId,
      f.variantId,
      'owner',
      [{ ...f.rows[0], percent: 90 }],
      f.versionId,
    )
    const v3 = await commitNewVersion(
      f.productId,
      f.variantId,
      'owner',
      [{ ...f.rows[0], percent: 80 }],
      v2,
    )
    expect((await getFormulaRows(f.versionId))[0].percent).toBe(100)
    expect((await getFormulaRows(v2))[0]).toMatchObject({ id: f.rows[0].id, percent: 90 })
    expect((await getFormulaRows(v3))[0].percent).toBe(80)
    expect(await getCurrentVersionForVariant(f.variantId)).toMatchObject({
      id: v3,
      versionNumber: 3,
    })
  })

  it('rolls back the new version and current flag if inserting its rows fails', async () => {
    const f = await fixture()
    await expect(
      commitNewVersion(f.productId, f.variantId, 'owner', [f.rows[0], f.rows[0]], f.versionId),
    ).rejects.toThrow()
    expect(await getCurrentVersionForVariant(f.variantId)).toMatchObject({ id: f.versionId })
    expect(await getFormulaRows(f.versionId)).toEqual(f.rows)
    expect(
      await db
        .select()
        .from(schema.formulaVersions)
        .where(eq(schema.formulaVersions.variantId, f.variantId)),
    ).toHaveLength(1)
  })

  it('rejects stale saves without overwriting the newer formula', async () => {
    const f = await fixture()
    const v2 = await commitNewVersion(f.productId, f.variantId, 'owner', f.rows, f.versionId)
    await expect(
      commitNewVersion(f.productId, f.variantId, 'owner', [], f.versionId),
    ).rejects.toMatchObject({ status: 409 })
    expect((await getCurrentVersionForVariant(f.variantId))?.id).toBe(v2)
  })
})

describe('formula write access', () => {
  it('enforces authentication, ownership, variant scope and the base version at the HTTP boundary', async () => {
    const f = await fixture()
    const other = await fixture('outsider')
    const route = appRoutes.find((entry) => entry.path === '/app/products/:productId/formula')!
    if (!('handler' in route)) throw new Error('Formula route must have a handler')
    const app = new Hono()
    app.put(route.path, route.handler as unknown as Handler)
    async function request(
      userId: string | null,
      variantId = f.variantId,
      expectedVersionId: string | undefined = f.versionId,
    ) {
      const token = userId
        ? await signAppToken({
            id: userId,
            email: `${userId}@test.local`,
            plan: 'free',
            activeOrganizationId: null,
          })
        : null
      return app.request(`/app/products/${f.productId}/formula`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ variantId, rows: f.rows, expectedVersionId }),
      })
    }
    expect((await request(null)).status).toBe(401)
    expect((await request('outsider')).status).toBe(404)
    expect((await request('viewer')).status).toBe(403)
    expect((await request('owner', other.variantId, other.versionId)).status).toBe(404)
    expect((await request('owner', f.variantId, 'stale')).status).toBe(409)
    const response = await request('owner')
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.workspace.variants[0].version.id).toBe(body.versionId)
    expect((await request('owner')).status).toBe(409)
    expect((await getCurrentVersionForVariant(other.variantId))?.id).toBe(other.versionId)
  })

  it('rejects a non-member and a read-only member before writing anything', async () => {
    const f = await fixture()
    for (const [userId, status] of [
      ['outsider', 404],
      ['viewer', 403],
    ] as const) {
      await expect(
        commitNewVersion(f.productId, f.variantId, userId, [], f.versionId),
      ).rejects.toMatchObject({ status })
    }
    expect((await getCurrentVersionForVariant(f.variantId))?.id).toBe(f.versionId)
    expect(await getFormulaRows(f.versionId)).toEqual(f.rows)
  })

  it('rejects a variant from another product, including when the caller owns both', async () => {
    const own = await fixture()
    for (const userId of ['outsider', 'owner']) {
      const other = await fixture(userId)
      await expect(
        commitNewVersion(own.productId, other.variantId, 'owner', [], other.versionId),
      ).rejects.toMatchObject({ status: 404 })
      expect(
        await createVariant(own.productId, 'owner', { copyFromVariantId: other.variantId }),
      ).toBeNull()
      expect((await getCurrentVersionForVariant(other.variantId))?.id).toBe(other.versionId)
    }
  })
})

describe('formula row lock', () => {
  it('updates the current version in place without creating a new version', async () => {
    const f = await fixture()
    const workspace = await updateFormulaRowLock(f.productId, 'owner', f.variantId, f.rows[0].id, true)
    const current = await getCurrentVersionForVariant(f.variantId)
    expect(current).toMatchObject({ id: f.versionId, versionNumber: 1 })
    expect((await getFormulaRows(f.versionId))[0].locked).toBe(true)
    expect(workspace.variants[0].rows[0].locked).toBe(true)
  })

  it('rejects a missing row, a variant from another product, and read-only access', async () => {
    const f = await fixture()
    const other = await fixture('outsider')
    await expect(
      updateFormulaRowLock(f.productId, 'owner', f.variantId, 'missing', true),
    ).rejects.toMatchObject({ status: 404 })
    await expect(
      updateFormulaRowLock(f.productId, 'owner', other.variantId, other.rows[0].id, true),
    ).rejects.toMatchObject({ status: 404 })
    await expect(
      updateFormulaRowLock(f.productId, 'viewer', f.variantId, f.rows[0].id, true),
    ).rejects.toMatchObject({ status: 403 })
    expect((await getFormulaRows(f.versionId))[0].locked).toBe(false)
    expect((await getCurrentVersionForVariant(f.variantId))?.id).toBe(f.versionId)
  })

  it('enforces authentication and ownership at the HTTP boundary', async () => {
    const f = await fixture()
    const route = appRoutes.find((entry) => entry.path === '/app/products/:productId/formula/lock')!
    if (!('handler' in route)) throw new Error('Lock route must have a handler')
    const app = new Hono()
    app.patch(route.path, route.handler as unknown as Handler)
    async function request(userId: string | null, body: Record<string, unknown> = {}) {
      const token = userId
        ? await signAppToken({
            id: userId,
            email: `${userId}@test.local`,
            plan: 'free',
            activeOrganizationId: null,
          })
        : null
      return app.request(`/app/products/${f.productId}/formula/lock`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          variantId: f.variantId,
          rowId: f.rows[0].id,
          locked: true,
          ...body,
        }),
      })
    }
    expect((await request(null)).status).toBe(401)
    expect((await request('outsider')).status).toBe(404)
    expect((await request('viewer')).status).toBe(403)
    const response = await request('owner')
    expect(response.status).toBe(200)
    const payload = await response.json()
    expect(payload.workspace.variants[0].rows[0].locked).toBe(true)
    expect((await getCurrentVersionForVariant(f.variantId))?.versionNumber).toBe(1)
  })
})

describe('accepting a formula proposal', () => {
  it('commits the patch and resolves it exactly once', async () => {
    const f = await fixture()
    const patchId = await createPatch({
      ...f,
      baseVersionId: f.versionId,
      summary: 'Adjust',
      operations: [{ op: 'update', rowId: f.rows[0].id, changes: { percent: 95 } }],
    })
    expect(await resolvePatch(patchId, f.productId, 'owner', 'accepted')).toMatchObject({
      status: 'accepted',
    })
    expect(await resolvePatch(patchId, f.productId, 'owner', 'accepted')).toBeNull()
    const version = (await getCurrentVersionForVariant(f.variantId))!
    expect(version.versionNumber).toBe(2)
    expect((await getFormulaRows(version.id))[0].percent).toBe(95)
    expect((await getFormulaRows(f.versionId))[0].percent).toBe(100)
  })

  it('keeps a stale proposal pending and allows it to be rejected', async () => {
    const f = await fixture()
    const patchId = await createPatch({
      ...f,
      baseVersionId: f.versionId,
      summary: 'Adjust',
      operations: [],
    })
    await commitNewVersion(f.productId, f.variantId, 'owner', f.rows, f.versionId)
    await expect(resolvePatch(patchId, f.productId, 'owner', 'accepted')).rejects.toMatchObject({
      status: 409,
    })
    expect((await listPatches(f.productId))[0].status).toBe('pending')
    expect(await resolvePatch(patchId, f.productId, 'owner', 'rejected')).toMatchObject({
      status: 'rejected',
    })
  })

  it('rolls back acceptance if a formula write fails', async () => {
    const f = await fixture()
    const patchId = await createPatch({
      ...f,
      baseVersionId: f.versionId,
      summary: 'Invalid reorder',
      operations: [{ op: 'reorder', rowIds: [f.rows[0].id, f.rows[0].id] }],
    })
    await expect(resolvePatch(patchId, f.productId, 'owner', 'accepted')).rejects.toThrow()
    expect((await listPatches(f.productId))[0].status).toBe('pending')
    expect((await getCurrentVersionForVariant(f.variantId))?.id).toBe(f.versionId)
  })

  it('rejects legacy proposals without a known base version', async () => {
    const f = await fixture()
    await db
      .insert(schema.formulaPatches)
      .values({
        id: 'legacy',
        productId: f.productId,
        variantId: f.variantId,
        status: 'pending',
        summary: 'Old proposal',
        operations: '[]',
        createdAt: '2026-09-01',
      })
    await expect(resolvePatch('legacy', f.productId, 'owner', 'accepted')).rejects.toMatchObject({
      status: 409,
    })
    expect((await listPatches(f.productId))[0].status).toBe('pending')
  })
})

describe('product duplicate, archive and delete', () => {
  it('copies the current formula, variants and brief into a new draft', async () => {
    const f = await fixture()
    await createVariant(f.productId, 'owner', {
      label: 'Night',
      copyFromVariantId: f.variantId,
    })
    await setProductPinned(f.productId, 'owner', true)
    const copy = await duplicateProduct(f.productId, 'owner', 'Face oil (copy)')
    if (!copy) throw new Error('Expected a duplicated product')
    expect(copy.id).not.toBe(f.productId)
    expect(copy).toMatchObject({
      name: 'Face oil (copy)',
      brief: 'Oil',
      type: 'skincare',
      status: 'draft',
      pinnedAt: null,
    })
    const source = (await getWorkspace(f.productId, 'owner'))!
    const duplicated = (await getWorkspace(copy.id, 'owner'))!
    expect(duplicated.variants).toHaveLength(source.variants.length)
    expect(duplicated.variants.map((item) => item.variant.label)).toEqual(
      source.variants.map((item) => item.variant.label),
    )
    expect(duplicated.variants[0].rows).toMatchObject([{ inci: 'Squalane', percent: 100 }])
    expect(duplicated.variants[0].rows[0].id).not.toBe(source.variants[0].rows[0].id)
    expect(await getProductForUser(f.productId, 'owner')).toMatchObject({ name: 'Face oil' })
  })

  it('hides archived products from the default list and clears the pin', async () => {
    const f = await fixture()
    await setProductPinned(f.productId, 'owner', true)
    const archived = await setProductArchived(f.productId, 'owner', true)
    expect(archived?.product).toMatchObject({ status: 'archived', pinnedAt: null })
    expect(await listProducts('owner')).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: f.productId })]),
    )
    expect(await listProducts('owner', { archived: true })).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: f.productId, status: 'archived' })]),
    )
    const restored = await setProductArchived(f.productId, 'owner', false)
    expect(restored?.product.status).toBe('draft')
    expect(await listProducts('owner')).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: f.productId })]),
    )
  })

  it('deletes a product and its formula rows', async () => {
    const f = await fixture()
    await expect(deleteProduct(f.productId, 'owner')).resolves.toBe(true)
    expect(await getProductForUser(f.productId, 'owner')).toBeNull()
    expect(
      await db.select().from(schema.productVariants).where(eq(schema.productVariants.productId, f.productId)),
    ).toHaveLength(0)
    expect(
      await db.select().from(schema.formulaVersions).where(eq(schema.formulaVersions.productId, f.productId)),
    ).toHaveLength(0)
  })

  it('rejects a viewer and an outsider before deleting', async () => {
    const f = await fixture()
    await expect(deleteProduct(f.productId, 'outsider')).rejects.toMatchObject({ status: 404 })
    await expect(deleteProduct(f.productId, 'viewer')).rejects.toMatchObject({ status: 403 })
    await expect(duplicateProduct(f.productId, 'viewer')).rejects.toMatchObject({ status: 403 })
    await expect(setProductArchived(f.productId, 'viewer', true)).rejects.toMatchObject({ status: 403 })
    expect(await getProductForUser(f.productId, 'owner')).not.toBeNull()
  })
})

it('migrates existing row data without changing IDs or contents', async () => {
  const client = createClient({ url: ':memory:' })
  try {
    await client.executeMultiple(await readFile(`${migrationsFolder}/0000_lowly_korg.sql`, 'utf8'))
    await client.executeMultiple(`
      INSERT INTO users (id, email, password_hash, created_at) VALUES ('u', 'u@test', 'x', 'today');
      INSERT INTO products (id, user_id, name, type, markets, brief, created_at, updated_at) VALUES ('p', 'u', 'Oil', 'skincare', '[]', '', 'today', 'today');
      INSERT INTO formula_versions (id, product_id, version_number, is_current, created_at) VALUES ('v', 'p', 1, 1, 'today');
      INSERT INTO formula_rows (id, version_id, inci, function, phase, percent, sort_order) VALUES ('r', 'v', 'Squalane', 'emollient', 'A', 100, 0);
    `)
    const before = (await client.execute('SELECT * FROM formula_rows')).rows
    await client.executeMultiple(
      await readFile(`${migrationsFolder}/0011_formula_version_rows.sql`, 'utf8'),
    )
    expect((await client.execute('SELECT * FROM formula_rows')).rows).toEqual(before)
    const migrated = drizzle(client, { schema })
    expect((await migrated.select().from(schema.formulaRows))[0]).toMatchObject({
      id: 'r',
      versionId: 'v',
      percent: 100,
    })
  } finally {
    client.close()
  }
})
