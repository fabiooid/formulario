import {
  IngredientCategorySchema,
  IngredientOriginTypeSchema,
  IngredientStockStatusSchema,
  TriStateFlagSchema,
  normalizeInci,
  type IngredientCategory,
  type IngredientOriginType,
  type IngredientStockStatus,
  type TriStateFlag,
} from '@formulario/domain'
import { and, eq } from 'drizzle-orm'
import { db } from '../db/client.js'
import { ingredients } from '../db/schema.js'
import { getActiveOrganizationId } from './organizations.js'
import { DEMO_INGREDIENTS } from '../db/demo-ingredients.js'

export type InventoryIngredientRecord = {
  id: string
  inci: string
  tradeName?: string
  cas?: string
  category: IngredientCategory
  stockStatus: IngredientStockStatus
  animalDerived: TriStateFlag
  originType: IngredientOriginType
  organicCertified: TriStateFlag
  pricePerKg?: number
  onHandGrams?: number
  notes?: string
  createdAt: string
  updatedAt: string
}

export type IngredientInput = {
  inci: string
  tradeName?: string | null
  cas?: string | null
  category: IngredientCategory
  stockStatus: IngredientStockStatus
  animalDerived: TriStateFlag
  originType: IngredientOriginType
  organicCertified: TriStateFlag
  pricePerKg?: number | null
  onHandGrams?: number | null
  notes?: string | null
}

function fromDb(row: typeof ingredients.$inferSelect): InventoryIngredientRecord {
  return {
    id: row.id,
    inci: row.inci,
    tradeName: row.tradeName ?? undefined,
    cas: row.cas ?? undefined,
    category: IngredientCategorySchema.parse(row.category),
    stockStatus: IngredientStockStatusSchema.parse(row.stockStatus),
    animalDerived: TriStateFlagSchema.parse(row.animalDerived),
    originType: IngredientOriginTypeSchema.parse(row.originType),
    organicCertified: TriStateFlagSchema.parse(row.organicCertified),
    pricePerKg: row.pricePerKg ?? undefined,
    onHandGrams: row.onHandGrams ?? undefined,
    notes: row.notes ?? undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

function emptyToNull(value?: string | null) {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

export async function listIngredients(userId: string): Promise<InventoryIngredientRecord[]> {
  const organizationId = await getActiveOrganizationId(userId)
  if (!organizationId) return []
  const rows = await db
    .select()
    .from(ingredients)
    .where(eq(ingredients.organizationId, organizationId))
    .orderBy(ingredients.inci)
  return rows.map(fromDb)
}

export async function getIngredient(userId: string, ingredientId: string) {
  const organizationId = await getActiveOrganizationId(userId)
  if (!organizationId) return null
  const [row] = await db
    .select()
    .from(ingredients)
    .where(and(eq(ingredients.id, ingredientId), eq(ingredients.organizationId, organizationId)))
    .limit(1)
  return row ? fromDb(row) : null
}

export async function findIngredientByInci(userId: string, inci: string) {
  const organizationId = await getActiveOrganizationId(userId)
  if (!organizationId) return null
  const row = await findDuplicate(organizationId, inci)
  return row ? fromDb(row) : null
}

async function findDuplicate(
  organizationId: string,
  inci: string,
  exceptId?: string,
) {
  const rows = await db
    .select()
    .from(ingredients)
    .where(eq(ingredients.organizationId, organizationId))
  const normalized = normalizeInci(inci)
  return rows.find((row) => {
    if (exceptId && row.id === exceptId) return false
    return normalizeInci(row.inci) === normalized
  })
}

export async function createIngredient(userId: string, input: IngredientInput) {
  const organizationId = await getActiveOrganizationId(userId)
  if (!organizationId) throw new Error('No organisation')
  if (await findDuplicate(organizationId, input.inci)) {
    throw new Error('This ingredient is already in your list')
  }

  const now = new Date().toISOString()
  const id = crypto.randomUUID()
  await db.insert(ingredients).values({
    id,
    organizationId,
    inci: input.inci.trim(),
    tradeName: emptyToNull(input.tradeName),
    cas: emptyToNull(input.cas),
    category: input.category,
    stockStatus: input.stockStatus,
    animalDerived: input.animalDerived,
    originType: input.originType,
    organicCertified: input.organicCertified,
    pricePerKg: input.pricePerKg ?? null,
    onHandGrams: input.onHandGrams ?? null,
    notes: emptyToNull(input.notes),
    createdAt: now,
    updatedAt: now,
  })

  const [created] = await db.select().from(ingredients).where(eq(ingredients.id, id)).limit(1)
  if (!created) throw new Error('Failed to load created ingredient')
  return fromDb(created)
}

export async function updateIngredient(userId: string, ingredientId: string, input: IngredientInput) {
  const organizationId = await getActiveOrganizationId(userId)
  if (!organizationId) return null
  const [existing] = await db
    .select()
    .from(ingredients)
    .where(and(eq(ingredients.id, ingredientId), eq(ingredients.organizationId, organizationId)))
    .limit(1)
  if (!existing) return null
  if (await findDuplicate(organizationId, input.inci, ingredientId)) {
    throw new Error('This ingredient is already in your list')
  }

  await db
    .update(ingredients)
    .set({
      inci: input.inci.trim(),
      tradeName: emptyToNull(input.tradeName),
      cas: emptyToNull(input.cas),
      category: input.category,
      stockStatus: input.stockStatus,
      animalDerived: input.animalDerived,
      originType: input.originType,
      organicCertified: input.organicCertified,
      pricePerKg: input.pricePerKg ?? null,
      onHandGrams: input.onHandGrams ?? null,
      notes: emptyToNull(input.notes),
      updatedAt: new Date().toISOString(),
    })
    .where(eq(ingredients.id, ingredientId))

  const [updated] = await db.select().from(ingredients).where(eq(ingredients.id, ingredientId)).limit(1)
  if (!updated) return null
  return fromDb(updated)
}

export async function deleteIngredient(userId: string, ingredientId: string) {
  const organizationId = await getActiveOrganizationId(userId)
  if (!organizationId) return false
  const [existing] = await db
    .select({ id: ingredients.id })
    .from(ingredients)
    .where(and(eq(ingredients.id, ingredientId), eq(ingredients.organizationId, organizationId)))
    .limit(1)
  if (!existing) return false
  await db.delete(ingredients).where(eq(ingredients.id, ingredientId))
  return true
}

export async function backfillIngredientClaimFlags() {
  const rows = await db.select().from(ingredients)
  const byInci = new Map(DEMO_INGREDIENTS.map((item) => [normalizeInci(item.inci), item]))
  for (const row of rows) {
    const demo = byInci.get(normalizeInci(row.inci))
    if (!demo) continue
    const unchanged =
      row.animalDerived === demo.animalDerived &&
      row.originType === demo.originType &&
      row.organicCertified === demo.organicCertified
    if (unchanged) continue
    if (
      row.animalDerived !== 'unknown' ||
      row.originType !== 'unknown' ||
      row.organicCertified !== 'unknown'
    ) {
      continue
    }
    await db
      .update(ingredients)
      .set({
        animalDerived: demo.animalDerived,
        originType: demo.originType,
        organicCertified: demo.organicCertified,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(ingredients.id, row.id))
  }
}

export async function backfillIngredientOnHand() {
  const rows = await db.select().from(ingredients)
  const byInci = new Map(DEMO_INGREDIENTS.map((item) => [normalizeInci(item.inci), item]))
  for (const row of rows) {
    if (row.onHandGrams != null) continue
    const demo = byInci.get(normalizeInci(row.inci))
    if (demo?.onHandGrams == null) continue
    await db
      .update(ingredients)
      .set({
        onHandGrams: demo.onHandGrams,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(ingredients.id, row.id))
  }
}

export async function backfillIngredientPrices() {
  const rows = await db.select().from(ingredients)
  const byInci = new Map(DEMO_INGREDIENTS.map((item) => [normalizeInci(item.inci), item]))
  for (const row of rows) {
    if (row.pricePerKg != null) continue
    const demo = byInci.get(normalizeInci(row.inci))
    if (demo?.pricePerKg == null) continue
    await db
      .update(ingredients)
      .set({
        pricePerKg: demo.pricePerKg,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(ingredients.id, row.id))
  }
}

export async function seedDemoIngredients(organizationId: string) {
  const existing = await db
    .select({ inci: ingredients.inci })
    .from(ingredients)
    .where(eq(ingredients.organizationId, organizationId))
  const have = new Set(existing.map((row) => normalizeInci(row.inci)))
  const missing = DEMO_INGREDIENTS.filter((item) => !have.has(normalizeInci(item.inci)))
  if (missing.length === 0) return

  const now = new Date().toISOString()
  await db.insert(ingredients).values(
    missing.map((item) => ({
      id: crypto.randomUUID(),
      organizationId,
      inci: item.inci,
      tradeName: item.tradeName ?? null,
      cas: null,
      category: item.category,
      stockStatus: item.stockStatus,
      animalDerived: item.animalDerived,
      originType: item.originType,
      organicCertified: item.organicCertified,
      pricePerKg: item.pricePerKg ?? null,
      onHandGrams: item.onHandGrams ?? null,
      notes: item.notes ?? null,
      createdAt: now,
      updatedAt: now,
    })),
  )
}
