import {
  applyPatchOperations,
  computeMacerationStatus,
  computeProductStage,
  evaluateClaimHits,
  generateInciList,
  generatePifDraft,
  normalizeProductClaims,
  runRegulatoryChecks,
  type FormulaRow,
  type IngredientRule,
  type Market,
  type PatchOperation,
  type ProductClaim,
  type ProductType,
  type ProductVariant,
} from '@atelier/domain'
import { and, desc, eq } from 'drizzle-orm'
import { db } from '../db/client.js'
import { getActiveOrganizationId, getMembership } from './organizations.js'
import { listIngredients } from './ingredients.js'
import {
  chatThreads,
  formulaPatches,
  formulaRows,
  formulaVersions,
  ingredientRules,
  pifDocuments,
  productVariants,
  products,
  regulatoryChecks,
} from '../db/schema.js'

function parseJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

export type OlfactoryPyramid = {
  direction: string
  top: string[]
  heart: string[]
  base: string[]
}

function pyramidFromDb(value: string | null): OlfactoryPyramid | null {
  if (!value) return null
  return parseJson<OlfactoryPyramid | null>(value, null)
}

export function rowFromDb(row: typeof formulaRows.$inferSelect): FormulaRow {
  return {
    id: row.id,
    inci: row.inci,
    cas: row.cas ?? undefined,
    tradeName: row.tradeName ?? undefined,
    function: row.function,
    phase: row.phase,
    percent: row.percent,
    notes: row.notes ?? undefined,
    locked: row.locked,
    sortOrder: row.sortOrder,
  }
}

export function rowsFromDraft(
  rows: Array<{
    inci: string
    cas?: string
    tradeName?: string
    function: string
    phase: string
    percent: number
    notes?: string
  }>,
): FormulaRow[] {
  return rows.map((row, index) => ({
    id: crypto.randomUUID(),
    inci: row.inci,
    cas: row.cas,
    tradeName: row.tradeName,
    function: row.function,
    phase: row.phase,
    percent: row.percent,
    notes: row.notes,
    locked: false,
    sortOrder: index,
  }))
}

export function variantFromDb(row: typeof productVariants.$inferSelect): ProductVariant {
  return {
    id: row.id,
    productId: row.productId,
    label: row.label,
    sortOrder: row.sortOrder,
    isSelectedFinal: row.isSelectedFinal,
    macerationStartedAt: row.macerationStartedAt,
    macerationTargetAt: row.macerationTargetAt,
    macerationNotes: row.macerationNotes,
    macerationStatus: computeMacerationStatus(row.macerationStartedAt, row.macerationTargetAt),
    createdAt: row.createdAt,
  }
}

export function ruleFromDb(rule: typeof ingredientRules.$inferSelect): IngredientRule {
  return {
    id: rule.id,
    version: rule.version,
    market: rule.market as Market,
    instrument: rule.instrument,
    substance: rule.substance,
    inciNames: parseJson<string[]>(rule.inciNames, []),
    casNumbers: rule.casNumbers ? parseJson<string[]>(rule.casNumbers, []) : undefined,
    maxPercent: rule.maxPercent ?? undefined,
    labelThresholdPercent: rule.labelThresholdPercent ?? undefined,
    effect: rule.effect as IngredientRule['effect'],
    citationUrl: rule.citationUrl,
    message: rule.message,
    productTypes: rule.productTypes
      ? (parseJson<ProductType[]>(rule.productTypes, []) as ProductType[])
      : undefined,
    leaveOnOnly: rule.leaveOnOnly ?? undefined,
    ifraCategory: rule.ifraCategory ?? undefined,
    preferredInci: rule.preferredInci ?? undefined,
  }
}

let cachedRules: IngredientRule[] | null = null

export async function loadRules(): Promise<IngredientRule[]> {
  if (cachedRules) return cachedRules
  const rows = await db.select().from(ingredientRules)
  cachedRules = rows.map(ruleFromDb)
  return cachedRules
}

export async function getProductForUser(productId: string, userId: string) {
  const [product] = await db.select().from(products).where(eq(products.id, productId)).limit(1)
  if (!product) return null
  if (product.organizationId) {
    const member = await getMembership(product.organizationId, userId)
    if (!member) return null
  } else if (product.userId !== userId) {
    return null
  }
  return {
    ...product,
    markets: parseJson<Market[]>(product.markets, ['EU']),
    claims: normalizeProductClaims(parseJson<string[]>(product.claims, [])),
    olfactoryPyramid: pyramidFromDb(product.olfactoryPyramid),
    type: product.type as ProductType,
  }
}

export async function listVariants(productId: string) {
  const rows = await db
    .select()
    .from(productVariants)
    .where(eq(productVariants.productId, productId))
    .orderBy(productVariants.sortOrder)
  return rows.map(variantFromDb)
}

export async function getVariant(variantId: string, productId: string) {
  const [variant] = await db
    .select()
    .from(productVariants)
    .where(and(eq(productVariants.id, variantId), eq(productVariants.productId, productId)))
    .limit(1)
  return variant ? variantFromDb(variant) : null
}

export async function getSelectedFinalVariant(productId: string) {
  const [variant] = await db
    .select()
    .from(productVariants)
    .where(and(eq(productVariants.productId, productId), eq(productVariants.isSelectedFinal, true)))
    .limit(1)
  return variant ? variantFromDb(variant) : null
}

export async function listProducts(userId: string) {
  const organizationId = await getActiveOrganizationId(userId)
  const rows = await db
    .select()
    .from(products)
    .where(organizationId ? eq(products.organizationId, organizationId) : eq(products.userId, userId))
    .orderBy(desc(products.updatedAt))

  const result = []
  for (const product of rows) {
    const variants = await listVariants(product.id)
    const variantWorkspaces = await Promise.all(
      variants.map(async (variant) => {
        const version = await getCurrentVersionForVariant(variant.id)
        const rowsForVariant = version ? await getFormulaRows(version.id) : []
        return { rows: rowsForVariant, isSelectedFinal: variant.isSelectedFinal }
      }),
    )
    result.push({
      ...product,
      markets: parseJson<Market[]>(product.markets, ['EU']),
      claims: normalizeProductClaims(parseJson<string[]>(product.claims, [])),
      olfactoryPyramid: pyramidFromDb(product.olfactoryPyramid),
      type: product.type as ProductType,
      stage: computeProductStage({ variants: variantWorkspaces }),
    })
  }
  return result
}

export async function getCurrentVersionForVariant(variantId: string) {
  const [version] = await db
    .select()
    .from(formulaVersions)
    .where(and(eq(formulaVersions.variantId, variantId), eq(formulaVersions.isCurrent, true)))
    .limit(1)
  return version ?? null
}

async function getActiveVersion(productId: string, variantId?: string) {
  if (variantId) return getCurrentVersionForVariant(variantId)
  const finalVariant = await getSelectedFinalVariant(productId)
  if (finalVariant) return getCurrentVersionForVariant(finalVariant.id)
  const variants = await listVariants(productId)
  if (variants[0]) return getCurrentVersionForVariant(variants[0].id)
  return null
}

export async function getFormulaRows(versionId: string): Promise<FormulaRow[]> {
  const rows = await db
    .select()
    .from(formulaRows)
    .where(eq(formulaRows.versionId, versionId))
    .orderBy(formulaRows.sortOrder)
  return rows.map(rowFromDb)
}

async function createVariantWithVersion(
  productId: string,
  label: string,
  sortOrder: number,
  rows: FormulaRow[] = [],
) {
  const now = new Date().toISOString()
  const variantId = crypto.randomUUID()
  const versionId = crypto.randomUUID()

  await db.insert(productVariants).values({
    id: variantId,
    productId,
    label,
    sortOrder,
    isSelectedFinal: false,
    createdAt: now,
  })

  await db.insert(formulaVersions).values({
    id: versionId,
    productId,
    variantId,
    versionNumber: 1,
    label: 'v1',
    isCurrent: true,
    createdAt: now,
  })

  if (rows.length > 0) {
    await saveFormulaRows(versionId, rows)
  }

  return variantId
}

export async function createProduct(input: {
  userId: string
  name: string
  type: ProductType
  markets: Market[]
  brief: string
  claims?: ProductClaim[]
  formula?: Array<{
    inci: string
    cas?: string
    tradeName?: string
    function: string
    phase: string
    percent: number
    notes?: string
  }>
}) {
  const id = crypto.randomUUID()
  const now = new Date().toISOString()
  const organizationId = await getActiveOrganizationId(input.userId)
  await db.insert(products).values({
    id,
    userId: input.userId,
    organizationId,
    name: input.name,
    type: input.type,
    markets: JSON.stringify(input.markets),
    brief: input.brief,
    claims: JSON.stringify(normalizeProductClaims(input.claims)),
    status: 'draft',
    createdAt: now,
    updatedAt: now,
  })

  await createVariantWithVersion(
    id,
    input.type === 'perfume' ? 'Variant 1' : 'Main',
    0,
    input.formula?.length ? rowsFromDraft(input.formula) : [],
  )

  const threadId = crypto.randomUUID()
  await db.insert(chatThreads).values({
    id: crypto.randomUUID(),
    productId: id,
    mastraThreadId: threadId,
    createdAt: now,
  })

  const product = await getProductForUser(id, input.userId)
  if (!product) throw new Error('Failed to load created product')
  return product
}

export async function updateProductName(productId: string, userId: string, name: string) {
  const product = await getProductForUser(productId, userId)
  if (!product) return null

  await db
    .update(products)
    .set({ name, updatedAt: new Date().toISOString() })
    .where(and(eq(products.id, productId), eq(products.userId, userId)))

  return getWorkspace(productId, userId)
}

export async function updateProductBrief(productId: string, userId: string, brief: string) {
  const product = await getProductForUser(productId, userId)
  if (!product) return null

  await db
    .update(products)
    .set({ brief, updatedAt: new Date().toISOString() })
    .where(and(eq(products.id, productId), eq(products.userId, userId)))

  return getWorkspace(productId, userId)
}

export async function setProductPinned(productId: string, userId: string, pinned: boolean) {
  const product = await getProductForUser(productId, userId)
  if (!product) return null

  await db
    .update(products)
    .set({ pinnedAt: pinned ? new Date().toISOString() : null })
    .where(eq(products.id, productId))

  return getWorkspace(productId, userId)
}

export async function updateProductClaims(productId: string, userId: string, claims: ProductClaim[]) {
  const product = await getProductForUser(productId, userId)
  if (!product) return null

  await db
    .update(products)
    .set({
      claims: JSON.stringify(normalizeProductClaims(claims)),
      updatedAt: new Date().toISOString(),
    })
    .where(eq(products.id, productId))

  await refreshDerived(productId, userId)
  return getWorkspace(productId, userId)
}

export async function updateOlfactoryPyramid(
  productId: string,
  userId: string,
  pyramid: OlfactoryPyramid,
) {
  const product = await getProductForUser(productId, userId)
  if (!product || product.type !== 'perfume') return null

  await db
    .update(products)
    .set({
      olfactoryPyramid: JSON.stringify(pyramid),
      updatedAt: new Date().toISOString(),
    })
    .where(and(eq(products.id, productId), eq(products.userId, userId)))

  return getWorkspace(productId, userId)
}

export async function saveFormulaRows(versionId: string, rows: FormulaRow[]) {
  await db.delete(formulaRows).where(eq(formulaRows.versionId, versionId))
  if (rows.length === 0) return
  await db.insert(formulaRows).values(
    rows.map((row, index) => ({
      id: row.id || crypto.randomUUID(),
      versionId,
      inci: row.inci,
      cas: row.cas,
      tradeName: row.tradeName,
      function: row.function,
      phase: row.phase,
      percent: row.percent,
      notes: row.notes,
      locked: row.locked,
      sortOrder: row.sortOrder ?? index,
    })),
  )
}

export async function commitNewVersion(
  productId: string,
  variantId: string,
  rows: FormulaRow[],
  label?: string,
) {
  const current = await getCurrentVersionForVariant(variantId)
  const now = new Date().toISOString()
  const nextNumber = (current?.versionNumber ?? 0) + 1
  const versionId = crypto.randomUUID()

  if (current) {
    await db
      .update(formulaVersions)
      .set({ isCurrent: false })
      .where(eq(formulaVersions.id, current.id))
  }

  await db.insert(formulaVersions).values({
    id: versionId,
    productId,
    variantId,
    versionNumber: nextNumber,
    label: label ?? `v${nextNumber}`,
    isCurrent: true,
    createdAt: now,
  })

  await saveFormulaRows(versionId, rows)
  await db.update(products).set({ updatedAt: now }).where(eq(products.id, productId))
  return versionId
}

export async function createVariant(
  productId: string,
  userId: string,
  input: { label?: string; copyFromVariantId?: string },
) {
  const product = await getProductForUser(productId, userId)
  if (!product) return null

  const existing = await listVariants(productId)
  const sortOrder = existing.length
  const label = input.label ?? `Variant ${sortOrder + 1}`

  let rows: FormulaRow[] = []
  if (input.copyFromVariantId) {
    const version = await getCurrentVersionForVariant(input.copyFromVariantId)
    if (version) {
      const sourceRows = await getFormulaRows(version.id)
      rows = sourceRows.map((row) => ({
        ...row,
        id: crypto.randomUUID(),
      }))
    }
  }

  const variantId = await createVariantWithVersion(productId, label, sortOrder, rows)
  await db.update(products).set({ updatedAt: new Date().toISOString() }).where(eq(products.id, productId))
  return getVariant(variantId, productId)
}

export async function renameVariant(
  variantId: string,
  productId: string,
  userId: string,
  label: string,
) {
  const product = await getProductForUser(productId, userId)
  if (!product) return null
  await db
    .update(productVariants)
    .set({ label })
    .where(and(eq(productVariants.id, variantId), eq(productVariants.productId, productId)))
  return getVariant(variantId, productId)
}

export async function setSelectedFinalVariant(productId: string, variantId: string, userId: string) {
  const product = await getProductForUser(productId, userId)
  if (!product) return null

  const variant = await getVariant(variantId, productId)
  if (!variant) return null

  const version = await getCurrentVersionForVariant(variantId)
  const rows = version ? await getFormulaRows(version.id) : []
  if (!rows.some((r) => r.inci.trim())) {
    throw new Error('Commit a formula before selecting this variant as final')
  }

  await db
    .update(productVariants)
    .set({ isSelectedFinal: false })
    .where(eq(productVariants.productId, productId))

  await db
    .update(productVariants)
    .set({ isSelectedFinal: true })
    .where(and(eq(productVariants.id, variantId), eq(productVariants.productId, productId)))

  await refreshDerived(productId, userId)
  return getWorkspace(productId, userId)
}

export async function updateMaceration(
  variantId: string,
  productId: string,
  userId: string,
  input: {
    macerationStartedAt?: string | null
    macerationTargetAt?: string | null
    macerationNotes?: string | null
  },
) {
  const product = await getProductForUser(productId, userId)
  if (!product) return null
  if (product.type !== 'perfume') {
    throw new Error('Maceration is only tracked for perfumes')
  }

  await db
    .update(productVariants)
    .set({
      macerationStartedAt: input.macerationStartedAt ?? null,
      macerationTargetAt: input.macerationTargetAt ?? null,
      macerationNotes: input.macerationNotes ?? null,
    })
    .where(and(eq(productVariants.id, variantId), eq(productVariants.productId, productId)))

  return getVariant(variantId, productId)
}

export async function refreshDerived(productId: string, userId: string) {
  const product = await getProductForUser(productId, userId)
  if (!product) return null

  const version = await getActiveVersion(productId)
  const rows = version ? await getFormulaRows(version.id) : []
  const rules = await loadRules()
  const checks = runRegulatoryChecks({
    rows,
    markets: product.markets,
    productType: product.type,
    rules,
  })

  const now = new Date().toISOString()
  await db.delete(regulatoryChecks).where(eq(regulatoryChecks.productId, productId))
  if (checks.length > 0) {
    await db.insert(regulatoryChecks).values(
      checks.map((check) => ({
        id: crypto.randomUUID(),
        productId,
        market: check.market,
        status: check.status,
        hits: JSON.stringify(check.hits),
        checkedAt: now,
      })),
    )
  }

  const inventory = await listIngredients(userId)
  const claimHits = evaluateClaimHits({
    claims: product.claims,
    rows,
    inventory,
  })
  const pif = generatePifDraft({ product, rows, checks, claimHits })
  await db.delete(pifDocuments).where(eq(pifDocuments.productId, productId))
  await db.insert(pifDocuments).values({
    id: crypto.randomUUID(),
    productId,
    markdown: pif.markdown,
    sections: JSON.stringify(pif.sections),
    generatedAt: now,
  })

  return { inci: generateInciList(rows), checks, pif }
}

export async function computeChecks(productId: string, userId: string, variantId?: string) {
  const product = await getProductForUser(productId, userId)
  if (!product) return []

  const version = await getActiveVersion(productId, variantId)

  const rows = version ? await getFormulaRows(version.id) : []
  const rules = await loadRules()
  return runRegulatoryChecks({
    rows,
    markets: product.markets,
    productType: product.type,
    rules,
  })
}

export async function createPatch(input: {
  productId: string
  variantId?: string
  summary: string
  operations: PatchOperation[]
  agentMessageId?: string
}) {
  const id = crypto.randomUUID()
  const now = new Date().toISOString()
  await db.insert(formulaPatches).values({
    id,
    productId: input.productId,
    variantId: input.variantId,
    status: 'pending',
    summary: input.summary,
    operations: JSON.stringify(input.operations),
    agentMessageId: input.agentMessageId,
    createdAt: now,
  })
  return id
}

export async function listPatches(productId: string, variantId?: string) {
  const rows = await db
    .select()
    .from(formulaPatches)
    .where(
      variantId
        ? and(eq(formulaPatches.productId, productId), eq(formulaPatches.variantId, variantId))
        : eq(formulaPatches.productId, productId),
    )
    .orderBy(desc(formulaPatches.createdAt))
  return rows.map((patch) => ({
    ...patch,
    operations: parseJson<PatchOperation[]>(patch.operations, []),
  }))
}

export async function resolvePatch(
  patchId: string,
  productId: string,
  userId: string,
  action: 'accepted' | 'rejected',
) {
  const product = await getProductForUser(productId, userId)
  if (!product) return null

  const [patch] = await db
    .select()
    .from(formulaPatches)
    .where(and(eq(formulaPatches.id, patchId), eq(formulaPatches.productId, productId)))
    .limit(1)
  if (!patch || patch.status !== 'pending') return null

  const now = new Date().toISOString()
  await db
    .update(formulaPatches)
    .set({ status: action, resolvedAt: now })
    .where(eq(formulaPatches.id, patchId))

  if (action === 'accepted') {
    const variantId = patch.variantId
    if (!variantId) return null
    const version = await getCurrentVersionForVariant(variantId)
    if (!version) return null
    const currentRows = await getFormulaRows(version.id)
    const operations = parseJson<PatchOperation[]>(patch.operations, [])
    const nextRows = applyPatchOperations(currentRows, operations)
    await commitNewVersion(productId, variantId, nextRows, `patch-${patchId.slice(0, 8)}`)
    const finalVariant = await getSelectedFinalVariant(productId)
    if (finalVariant?.id === variantId) {
      await refreshDerived(productId, userId)
    }
  }

  const workspace = await getWorkspace(productId, userId)
  if (!workspace) return null
  return { status: action, workspace }
}

export async function getChatThread(productId: string) {
  const [thread] = await db
    .select()
    .from(chatThreads)
    .where(eq(chatThreads.productId, productId))
    .limit(1)
  return thread ?? null
}

export async function getWorkspace(productId: string, userId: string) {
  const product = await getProductForUser(productId, userId)
  if (!product) return null

  const variantsList = await listVariants(productId)
  const variants = await Promise.all(
    variantsList.map(async (variant) => {
      const version = await getCurrentVersionForVariant(variant.id)
      const rows = version ? await getFormulaRows(version.id) : []
      return {
        variant,
        version: version
          ? { id: version.id, versionNumber: version.versionNumber, label: version.label }
          : null,
        rows,
      }
    }),
  )

  const selectedFinalVariantId =
    variantsList.find((v) => v.isSelectedFinal)?.id ?? null

  const [pifRows, checks, thread] = await Promise.all([
    db.select().from(pifDocuments).where(eq(pifDocuments.productId, productId)).limit(1),
    db.select().from(regulatoryChecks).where(eq(regulatoryChecks.productId, productId)),
    getChatThread(productId),
  ])
  const [pif] = pifRows

  const activeVariantId = selectedFinalVariantId ?? variantsList[0]?.id ?? null
  const patches = activeVariantId
    ? await listPatches(productId, activeVariantId)
    : await listPatches(productId)

  return {
    product,
    stage: computeProductStage({
      variants: variants.map((v) => ({
        rows: v.rows,
        isSelectedFinal: v.variant.isSelectedFinal,
      })),
    }),
    variants,
    selectedFinalVariantId,
    activeVariantId,
    patches,
    pif: pif
      ? {
          markdown: pif.markdown,
          sections: parseJson(pif.sections, []),
          generatedAt: pif.generatedAt,
        }
      : null,
    checks: checks.map((check) => ({
      market: check.market,
      status: check.status,
      hits: parseJson(check.hits, []),
      checkedAt: check.checkedAt,
    })),
    thread,
  }
}
