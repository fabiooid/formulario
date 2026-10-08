import { z } from 'zod'

export const ProductTypeSchema = z.enum(['skincare', 'perfume', 'hybrid'])
export type ProductType = z.infer<typeof ProductTypeSchema>

export const MarketSchema = z.enum(['EU', 'UK', 'US', 'HK', 'ASEAN'])
export type Market = z.infer<typeof MarketSchema>

export const PlanSchema = z.enum(['free', 'paid'])
export type Plan = z.infer<typeof PlanSchema>

export const RegulatoryStatusSchema = z.enum([
  'sellable',
  'restricted',
  'banned',
  'unknown',
  'not_listed',
])
export type RegulatoryStatus = z.infer<typeof RegulatoryStatusSchema>

export const RuleEffectSchema = z.enum([
  'cannot_sell',
  'relabel',
  'reduce_percent',
  'inci_wording',
])
export type RuleEffect = z.infer<typeof RuleEffectSchema>

export const PatchStatusSchema = z.enum(['pending', 'accepted', 'rejected'])
export type PatchStatus = z.infer<typeof PatchStatusSchema>

export const FormulaRowSchema = z.object({
  id: z.string(),
  inci: z.string(),
  cas: z.string().optional(),
  tradeName: z.string().optional(),
  function: z.string(),
  phase: z.string(),
  percent: z.number(),
  notes: z.string().optional(),
  sortOrder: z.number(),
})
export type FormulaRow = z.infer<typeof FormulaRowSchema>

export const PatchOperationSchema = z.discriminatedUnion('op', [
  z.object({
    op: z.literal('add'),
    row: FormulaRowSchema.omit({ id: true, sortOrder: true }).extend({
      sortOrder: z.number().optional(),
    }),
  }),
  z.object({
    op: z.literal('update'),
    rowId: z.string(),
    changes: FormulaRowSchema.partial().omit({ id: true }),
  }),
  z.object({
    op: z.literal('remove'),
    rowId: z.string(),
  }),
  z.object({
    op: z.literal('reorder'),
    rowIds: z.array(z.string()),
  }),
])
export type PatchOperation = z.infer<typeof PatchOperationSchema>

export const FormulaPatchSchema = z.object({
  id: z.string(),
  productId: z.string(),
  status: PatchStatusSchema,
  summary: z.string(),
  operations: z.array(PatchOperationSchema),
  agentMessageId: z.string().optional(),
  createdAt: z.string(),
})
export type FormulaPatch = z.infer<typeof FormulaPatchSchema>

export const RegulatoryHitSchema = z.object({
  market: MarketSchema,
  instrument: z.string(),
  substance: z.string(),
  inci: z.string(),
  limit: z.string().optional(),
  effect: RuleEffectSchema,
  citationUrl: z.string().url(),
  message: z.string(),
})
export type RegulatoryHit = z.infer<typeof RegulatoryHitSchema>

export const RegulatoryCheckResultSchema = z.object({
  market: MarketSchema,
  status: RegulatoryStatusSchema,
  hits: z.array(RegulatoryHitSchema),
})
export type RegulatoryCheckResult = z.infer<typeof RegulatoryCheckResultSchema>

export const IngredientRuleSchema = z.object({
  id: z.string(),
  version: z.string(),
  market: MarketSchema,
  instrument: z.string(),
  substance: z.string(),
  inciNames: z.array(z.string()),
  casNumbers: z.array(z.string()).optional(),
  maxPercent: z.number().optional(),
  labelThresholdPercent: z.number().optional(),
  effect: RuleEffectSchema,
  citationUrl: z.string().url(),
  message: z.string(),
  productTypes: z.array(ProductTypeSchema).optional(),
  leaveOnOnly: z.boolean().optional(),
  ifraCategory: z.string().optional(),
  preferredInci: z.string().optional(),
})
export type IngredientRule = z.infer<typeof IngredientRuleSchema>

export const ProductClaimSchema = z.enum(['vegan', 'natural', 'organic'])
export type ProductClaim = z.infer<typeof ProductClaimSchema>
export const PRODUCT_CLAIMS: ProductClaim[] = ['vegan', 'natural', 'organic']

export function normalizeProductClaims(claims: Iterable<string> | null | undefined): ProductClaim[] {
  const allowed = new Set<string>(PRODUCT_CLAIMS)
  const selected = new Set<ProductClaim>()
  for (const claim of claims ?? []) {
    if (allowed.has(claim)) selected.add(claim as ProductClaim)
  }
  return PRODUCT_CLAIMS.filter((claim) => selected.has(claim))
}

export const ProductSchema = z.object({
  id: z.string(),
  userId: z.string(),
  name: z.string(),
  type: ProductTypeSchema,
  markets: z.array(MarketSchema),
  brief: z.string(),
  claims: z.array(ProductClaimSchema).default([]),
  status: z.string(),
})
export type Product = z.infer<typeof ProductSchema>

export const PAID_MARKETS: Market[] = ['UK', 'US', 'HK', 'ASEAN']
export const FREE_MARKETS: Market[] = ['EU']
export const COSING_URL = 'https://ec.europa.eu/growth/sectors/cosmetics/cosing_en'

export const MacerationStatusSchema = z.enum(['fresh', 'macerating', 'ready'])
export type MacerationStatus = z.infer<typeof MacerationStatusSchema>

export const ProductStageSchema = z.enum(['idea', 'formula', 'final'])
export type ProductStage = z.infer<typeof ProductStageSchema>

export const ProductVariantSchema = z.object({
  id: z.string(),
  productId: z.string(),
  label: z.string(),
  sortOrder: z.number(),
  isSelectedFinal: z.boolean(),
  macerationStartedAt: z.string().nullable().optional(),
  macerationTargetAt: z.string().nullable().optional(),
  macerationNotes: z.string().nullable().optional(),
  macerationStatus: MacerationStatusSchema.optional(),
  createdAt: z.string(),
})
export type ProductVariant = z.infer<typeof ProductVariantSchema>

export const VariantWorkspaceSchema = z.object({
  variant: ProductVariantSchema,
  version: z
    .object({
      id: z.string(),
      versionNumber: z.number(),
      label: z.string().nullable(),
    })
    .nullable(),
  rows: z.array(FormulaRowSchema),
})
export type VariantWorkspace = z.infer<typeof VariantWorkspaceSchema>

export function computeMacerationStatus(
  startedAt?: string | null,
  targetAt?: string | null,
): MacerationStatus {
  if (!startedAt) return 'fresh'
  if (targetAt && new Date(targetAt) <= new Date()) return 'ready'
  return 'macerating'
}

export function computeProductStage(input: {
  variants: Array<{ rows: FormulaRow[]; isSelectedFinal: boolean }>
}): ProductStage {
  const hasAnyRows = input.variants.some((v) => v.rows.some((r) => r.inci.trim()))
  const hasFinal = input.variants.some((v) => v.isSelectedFinal && v.rows.some((r) => r.inci.trim()))
  if (hasFinal) return 'final'
  if (hasAnyRows) return 'formula'
  return 'idea'
}

export function normalizeInci(inci: string): string {
  return inci.trim().toLowerCase()
}

const WATER_INCI = new Set(['aqua', 'water', 'aqua (water)', 'water (aqua)', 'aqua/water', 'water/aqua', 'eau'])

/** True only for plain water — never for anything that merely contains "aqua" (e.g. Aquaxyl). */
export function isWaterInci(inci: string): boolean {
  return WATER_INCI.has(normalizeInci(inci).replace(/\s+/g, ' '))
}

export const IngredientStockStatusSchema = z.enum(['in_house', 'low', 'to_buy'])
export type IngredientStockStatus = z.infer<typeof IngredientStockStatusSchema>

export const IngredientCategorySchema = z.enum([
  'solvent',
  'emollient',
  'fragrance',
  'preservative',
  'antioxidant',
  'carrier',
  'active',
  'other',
])
export type IngredientCategory = z.infer<typeof IngredientCategorySchema>

export const TriStateFlagSchema = z.enum(['yes', 'no', 'unknown'])
export type TriStateFlag = z.infer<typeof TriStateFlagSchema>

export const IngredientOriginTypeSchema = z.enum(['natural', 'synthetic', 'unknown'])
export type IngredientOriginType = z.infer<typeof IngredientOriginTypeSchema>

export const InventoryIngredientSchema = z.object({
  id: z.string(),
  inci: z.string(),
  tradeName: z.string().optional(),
  cas: z.string().optional(),
  category: IngredientCategorySchema,
  stockStatus: IngredientStockStatusSchema,
  animalDerived: TriStateFlagSchema.default('unknown'),
  originType: IngredientOriginTypeSchema.default('unknown'),
  organicCertified: TriStateFlagSchema.default('unknown'),
  pricePerKg: z.number().nonnegative().optional(),
  onHandGrams: z.number().nonnegative().optional(),
  notes: z.string().optional(),
})
export type InventoryIngredient = z.infer<typeof InventoryIngredientSchema>

export const IngredientInputSchema = z.object({
  inci: z.string().trim().min(1).max(120),
  tradeName: z.string().trim().max(120).optional().nullable(),
  cas: z.string().trim().max(40).optional().nullable(),
  category: IngredientCategorySchema,
  stockStatus: IngredientStockStatusSchema,
  animalDerived: TriStateFlagSchema.default('unknown'),
  originType: IngredientOriginTypeSchema.default('unknown'),
  organicCertified: TriStateFlagSchema.default('unknown'),
  pricePerKg: z.number().nonnegative().max(1_000_000).nullable().optional(),
  onHandGrams: z.number().nonnegative().max(10_000_000).nullable().optional(),
  notes: z.string().trim().max(500).optional().nullable(),
})
export type IngredientInput = z.infer<typeof IngredientInputSchema>

export const AgentProposalKindSchema = z.enum([
  'inventory_create',
  'inventory_update',
  'product_create',
])
export type AgentProposalKind = z.infer<typeof AgentProposalKindSchema>

export const AgentProposalStatusSchema = z.enum(['pending', 'accepted', 'rejected'])
export type AgentProposalStatus = z.infer<typeof AgentProposalStatusSchema>

export const InventoryCreatePayloadSchema = z.object({
  ingredient: IngredientInputSchema,
})
export type InventoryCreatePayload = z.infer<typeof InventoryCreatePayloadSchema>

export const InventoryUpdatePayloadSchema = z.object({
  ingredientId: z.string(),
  ingredient: IngredientInputSchema,
})
export type InventoryUpdatePayload = z.infer<typeof InventoryUpdatePayloadSchema>


export const ProductCreatePayloadSchema = z.object({
  name: z.string().trim().min(1).max(120),
  type: ProductTypeSchema,
  markets: z.array(MarketSchema).default(['EU']),
  brief: z.string().min(1),
  claims: z.array(ProductClaimSchema).optional(),
})
export type ProductCreatePayload = z.infer<typeof ProductCreatePayloadSchema>

export const PurchaseReasonSchema = z.enum(['missing', 'low', 'to_buy'])
export type PurchaseReason = z.infer<typeof PurchaseReasonSchema>

export type PurchaseSuggestion = {
  inci: string
  reason: PurchaseReason
  usedIn: string[]
  pricePerKg?: number
}

export function findInventoryMatch<T extends { inci: string }>(
  inci: string,
  inventory: T[],
): T | undefined {
  const normalized = normalizeInci(inci)
  if (!normalized) return undefined
  return inventory.find((item) => normalizeInci(item.inci) === normalized)
}

function withPrice(
  suggestion: PurchaseSuggestion,
  pricePerKg?: number | null,
): PurchaseSuggestion {
  if (pricePerKg == null) return suggestion
  return { ...suggestion, pricePerKg }
}

export function collectPurchaseSuggestions(
  usedIngredients: Array<{ inci: string; productName: string }>,
  inventory: Array<{ inci: string; stockStatus: IngredientStockStatus; pricePerKg?: number | null }>,
  options?: { includeUnused?: boolean },
): PurchaseSuggestion[] {
  const usedByInci = new Map<string, { display: string; usedIn: Set<string> }>()
  for (const item of usedIngredients) {
    const key = normalizeInci(item.inci)
    if (!key) continue
    const existing = usedByInci.get(key)
    if (existing) existing.usedIn.add(item.productName)
    else usedByInci.set(key, { display: item.inci.trim(), usedIn: new Set([item.productName]) })
  }

  const suggestions: PurchaseSuggestion[] = []
  const seen = new Set<string>()

  for (const [key, value] of usedByInci) {
    const match = inventory.find((item) => normalizeInci(item.inci) === key)
    if (!match) {
      suggestions.push({ inci: value.display, reason: 'missing', usedIn: [...value.usedIn] })
      seen.add(key)
      continue
    }
    if (match.stockStatus === 'to_buy' || match.stockStatus === 'low') {
      suggestions.push(
        withPrice(
          {
            inci: match.inci,
            reason: match.stockStatus,
            usedIn: [...value.usedIn],
          },
          match.pricePerKg,
        ),
      )
      seen.add(key)
    }
  }

  for (const item of inventory) {
    if (options?.includeUnused === false) continue
    if (item.stockStatus !== 'to_buy' && item.stockStatus !== 'low') continue
    const key = normalizeInci(item.inci)
    if (!key || seen.has(key)) continue
    suggestions.push(
      withPrice({ inci: item.inci, reason: item.stockStatus, usedIn: [] }, item.pricePerKg),
    )
    seen.add(key)
  }

  const order: Record<PurchaseReason, number> = { missing: 0, to_buy: 1, low: 2 }
  return suggestions.sort((a, b) => order[a.reason] - order[b.reason] || a.inci.localeCompare(b.inci))
}

export function formulaPercentTotal(rows: Pick<FormulaRow, 'percent'>[]): number {
  return Math.round(rows.reduce((sum, row) => sum + row.percent, 0) * 100) / 100
}

export function isPercentBalanced(rows: Pick<FormulaRow, 'percent'>[], tolerance = 0.5): boolean {
  const total = formulaPercentTotal(rows)
  return Math.abs(total - 100) <= tolerance
}

/** Colour Index names such as "CI 77891" — listed last on an EU label. */
export function isColorantInci(inci: string): boolean {
  return /^ci\s?\d{5}(?:[:/]\d+)?$/i.test(inci.trim())
}

/**
 * Merge rows that share an INCI name (case-insensitive) and sum their percentages.
 * Used for labelling and for regulatory limits, which apply to the total, not to one row.
 */
export function aggregateRowsByInci<T extends Pick<FormulaRow, 'inci' | 'percent'>>(
  rows: T[],
): Array<T & { percent: number }> {
  const merged = new Map<string, T & { percent: number }>()
  for (const row of rows) {
    const display = row.inci.trim()
    if (!display) continue
    const key = normalizeInci(display)
    const existing = merged.get(key)
    if (existing) existing.percent += row.percent
    else merged.set(key, { ...row, inci: display, percent: row.percent })
  }
  return [...merged.values()]
}

/**
 * EU-style INCI list (Reg. 1223/2009 art. 19):
 * ingredients at 1% or more in descending order, then those under 1%
 * (any order is allowed — we keep descending so the list is stable), colourants last.
 * Duplicate INCI names are merged first. Wording (e.g. Fragrance → Parfum) is not rewritten
 * here; the regulatory check flags it so the person can fix the formula row.
 */
export function generateInciList(rows: Pick<FormulaRow, 'inci' | 'percent'>[]): string {
  const byPercentDesc = (a: { percent: number }, b: { percent: number }) => b.percent - a.percent
  const merged = aggregateRowsByInci(rows)
  const colorants = merged.filter((row) => isColorantInci(row.inci)).sort(byPercentDesc)
  const others = merged.filter((row) => !isColorantInci(row.inci))
  const onePercentOrMore = others.filter((row) => row.percent >= 1).sort(byPercentDesc)
  const underOnePercent = others.filter((row) => row.percent < 1).sort(byPercentDesc)
  return [...onePercentOrMore, ...underOnePercent, ...colorants].map((row) => row.inci).join(', ')
}
