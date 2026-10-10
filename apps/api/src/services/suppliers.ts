import { and, eq } from 'drizzle-orm'
import { db } from '../db/client.js'
import { ingredients, suppliers } from '../db/schema.js'
import { getActiveOrganizationId } from './organizations.js'

export type SupplierRecord = {
  id: string
  name: string
  website?: string
  notes?: string
  contactEmail?: string
  createdAt: string
  updatedAt: string
}

export type SupplierInput = {
  name: string
  website?: string | null
  notes?: string | null
  contactEmail?: string | null
}

export type SupplierIngredientLink = {
  id: string
  inci: string
  tradeName?: string
  pricePerKg?: number
  supplierProductUrl?: string
  stockStatus: string
}

export type SupplierWithIngredients = SupplierRecord & {
  ingredients: SupplierIngredientLink[]
}

function emptyToNull(value?: string | null) {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

function fromDb(row: typeof suppliers.$inferSelect): SupplierRecord {
  return {
    id: row.id,
    name: row.name,
    website: row.website ?? undefined,
    notes: row.notes ?? undefined,
    contactEmail: row.contactEmail ?? undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

async function findDuplicateName(organizationId: string, name: string, exceptId?: string) {
  const rows = await db
    .select()
    .from(suppliers)
    .where(eq(suppliers.organizationId, organizationId))
  const normalized = name.trim().toLowerCase()
  return rows.find((row) => {
    if (exceptId && row.id === exceptId) return false
    return row.name.trim().toLowerCase() === normalized
  })
}

export async function listSuppliers(userId: string): Promise<SupplierWithIngredients[]> {
  const organizationId = await getActiveOrganizationId(userId)
  if (!organizationId) return []

  const supplierRows = await db
    .select()
    .from(suppliers)
    .where(eq(suppliers.organizationId, organizationId))
    .orderBy(suppliers.name)

  const ingredientRows = await db
    .select({
      id: ingredients.id,
      inci: ingredients.inci,
      tradeName: ingredients.tradeName,
      pricePerKg: ingredients.pricePerKg,
      supplierProductUrl: ingredients.supplierProductUrl,
      stockStatus: ingredients.stockStatus,
      supplierId: ingredients.supplierId,
    })
    .from(ingredients)
    .where(eq(ingredients.organizationId, organizationId))

  return supplierRows.map((row) => ({
    ...fromDb(row),
    ingredients: ingredientRows
      .filter((item) => item.supplierId === row.id)
      .map((item) => ({
        id: item.id,
        inci: item.inci,
        tradeName: item.tradeName ?? undefined,
        pricePerKg: item.pricePerKg ?? undefined,
        supplierProductUrl: item.supplierProductUrl ?? undefined,
        stockStatus: item.stockStatus,
      }))
      .sort((a, b) => a.inci.localeCompare(b.inci)),
  }))
}

export async function getSupplier(userId: string, supplierId: string) {
  const organizationId = await getActiveOrganizationId(userId)
  if (!organizationId) return null
  const [row] = await db
    .select()
    .from(suppliers)
    .where(and(eq(suppliers.id, supplierId), eq(suppliers.organizationId, organizationId)))
    .limit(1)
  return row ? fromDb(row) : null
}

export async function createSupplier(userId: string, input: SupplierInput) {
  const organizationId = await getActiveOrganizationId(userId)
  if (!organizationId) throw new Error('No organisation')
  if (await findDuplicateName(organizationId, input.name)) {
    throw new Error('This supplier is already in your list')
  }

  const now = new Date().toISOString()
  const id = crypto.randomUUID()
  await db.insert(suppliers).values({
    id,
    organizationId,
    name: input.name.trim(),
    website: emptyToNull(input.website),
    notes: emptyToNull(input.notes),
    contactEmail: emptyToNull(input.contactEmail),
    createdAt: now,
    updatedAt: now,
  })

  const [created] = await db.select().from(suppliers).where(eq(suppliers.id, id)).limit(1)
  if (!created) throw new Error('Failed to load created supplier')
  return fromDb(created)
}

export async function updateSupplier(userId: string, supplierId: string, input: SupplierInput) {
  const organizationId = await getActiveOrganizationId(userId)
  if (!organizationId) return null
  const [existing] = await db
    .select()
    .from(suppliers)
    .where(and(eq(suppliers.id, supplierId), eq(suppliers.organizationId, organizationId)))
    .limit(1)
  if (!existing) return null
  if (await findDuplicateName(organizationId, input.name, supplierId)) {
    throw new Error('This supplier is already in your list')
  }

  await db
    .update(suppliers)
    .set({
      name: input.name.trim(),
      website: emptyToNull(input.website),
      notes: emptyToNull(input.notes),
      contactEmail: emptyToNull(input.contactEmail),
      updatedAt: new Date().toISOString(),
    })
    .where(eq(suppliers.id, supplierId))

  const [updated] = await db.select().from(suppliers).where(eq(suppliers.id, supplierId)).limit(1)
  return updated ? fromDb(updated) : null
}

export async function deleteSupplier(userId: string, supplierId: string) {
  const organizationId = await getActiveOrganizationId(userId)
  if (!organizationId) return false
  const [existing] = await db
    .select({ id: suppliers.id })
    .from(suppliers)
    .where(and(eq(suppliers.id, supplierId), eq(suppliers.organizationId, organizationId)))
    .limit(1)
  if (!existing) return false

  await db
    .update(ingredients)
    .set({ supplierId: null, updatedAt: new Date().toISOString() })
    .where(and(eq(ingredients.organizationId, organizationId), eq(ingredients.supplierId, supplierId)))
  await db.delete(suppliers).where(eq(suppliers.id, supplierId))
  return true
}

export async function assertSupplierInOrg(organizationId: string, supplierId: string | null | undefined) {
  if (!supplierId) return true
  const [row] = await db
    .select({ id: suppliers.id })
    .from(suppliers)
    .where(and(eq(suppliers.id, supplierId), eq(suppliers.organizationId, organizationId)))
    .limit(1)
  return Boolean(row)
}

/** Demo suppliers for the seeded personal org. Safe to re-run. */
export async function seedDemoSuppliers(organizationId: string) {
  const existing = await db
    .select()
    .from(suppliers)
    .where(eq(suppliers.organizationId, organizationId))
  if (existing.length > 0) return

  const now = new Date().toISOString()
  const aromaId = 'demo-supplier-aroma'
  const perfumeId = 'demo-supplier-perfume'

  await db.insert(suppliers).values([
    {
      id: aromaId,
      organizationId,
      name: 'Aroma Zone',
      website: 'https://www.aroma-zone.com',
      notes: 'Naturals and carriers for small batches.',
      contactEmail: null,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: perfumeId,
      organizationId,
      name: 'Creating Perfume',
      website: 'https://www.creatingperfume.com',
      notes: 'Fragrance materials.',
      contactEmail: null,
      createdAt: now,
      updatedAt: now,
    },
  ])

  const links: Array<{ inci: string; supplierId: string; url?: string }> = [
    {
      inci: 'Shea Butter',
      supplierId: aromaId,
      url: 'https://www.aroma-zone.com/info/fiche-technique/beurre-de-karite-bio-aroma-zone',
    },
    { inci: 'Vanilla Absolute', supplierId: perfumeId },
    { inci: 'Coumarin', supplierId: perfumeId },
    { inci: 'Squalane', supplierId: aromaId },
  ]

  const rows = await db
    .select()
    .from(ingredients)
    .where(eq(ingredients.organizationId, organizationId))

  for (const link of links) {
    const match = rows.find((row) => row.inci.trim().toLowerCase() === link.inci.toLowerCase())
    if (!match || match.supplierId) continue
    await db
      .update(ingredients)
      .set({
        supplierId: link.supplierId,
        supplierProductUrl: link.url ?? null,
        updatedAt: now,
      })
      .where(eq(ingredients.id, match.id))
  }
}
