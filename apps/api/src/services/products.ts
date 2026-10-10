import {
  applyPatchOperations,
  computeMacerationStatus,
  computeProductStage,
  generateInciList,
  normalizeProductClaims,
  productTracksMaceration,
  runRegulatoryChecks,
  type FormulaRow,
  type FormulaVersionSummary,
  type FormulaVersionWorkspace,
  type IngredientRule,
  type Market,
  type PatchOperation,
  type ProductClaim,
  type ProductType,
  type ProductVariant,
} from '@formulario/domain'
import { and, desc, eq, inArray, ne, or } from 'drizzle-orm'
import { db } from '../db/client.js'
import { getActiveOrganizationId, getMembership } from './organizations.js'
import {
  chatThreads,
  formulaPatches,
  formulaRows,
  formulaVersions,
  ingredientRules,
  organizationMembers,
  productVariants,
  products,
  regulatoryChecks,
} from '../db/schema.js'

type DatabaseSession = Pick<typeof db, 'select' | 'insert' | 'update' | 'delete'>

export class ProductWriteError extends Error {
  constructor(
    public status: 403 | 404 | 409,
    public code: string,
    message: string,
  ) {
    super(message)
  }
}

async function requireWritableProduct(session: DatabaseSession, productId: string, userId: string) {
  const [product] = await session.select().from(products).where(eq(products.id, productId)).limit(1)
  const notFound = () => new ProductWriteError(404, 'not_found', 'Product or variant not found')
  if (!product) throw notFound()
  if (product.organizationId) {
    const [member] = await session
      .select()
      .from(organizationMembers)
      .where(
        and(
          eq(organizationMembers.organizationId, product.organizationId),
          eq(organizationMembers.userId, userId),
        ),
      )
      .limit(1)
    if (!member) throw notFound()
    if (member.role === 'viewer')
      throw new ProductWriteError(403, 'read_only', 'This workspace is read-only')
  } else if (product.userId !== userId) throw notFound()
  return product
}

function parseJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

function productFromRow(product: typeof products.$inferSelect) {
  return {
    ...product,
    markets: parseJson<Market[]>(product.markets, ['EU']),
    claims: normalizeProductClaims(parseJson<string[]>(product.claims, [])),
    type: product.type as ProductType,
  }
}

type CurrentVariantFormula = {
  variant: ProductVariant
  version: FormulaVersionSummary | null
  versions: FormulaVersionWorkspace[]
  rows: FormulaRow[]
}

function stageFromVariants(variants: CurrentVariantFormula[]) {
  return computeProductStage({
    variants: variants.map((item) => ({
      rows: item.rows,
      hasFinalVersion: item.versions.some(
        (version) => version.isFinal && version.rows.some((row) => row.inci.trim()),
      ),
    })),
  })
}

async function loadCurrentVariantFormulas(productIds: string[], options?: { allVersions?: boolean }) {
  const byProduct = new Map<string, CurrentVariantFormula[]>()
  for (const id of productIds) byProduct.set(id, [])
  if (productIds.length === 0) return byProduct

  const variantRows = await db
    .select()
    .from(productVariants)
    .where(inArray(productVariants.productId, productIds))

  const variantIds = variantRows.map((row) => row.id)
  const versionRows =
    variantIds.length === 0
      ? []
      : await db
          .select()
          .from(formulaVersions)
          .where(
            options?.allVersions
              ? inArray(formulaVersions.variantId, variantIds)
              : and(
                  inArray(formulaVersions.variantId, variantIds),
                  or(eq(formulaVersions.isCurrent, true), eq(formulaVersions.isFinal, true)),
                ),
          )

  const versionsByVariantId = new Map<string, FormulaVersionSummary[]>()
  for (const version of versionRows) {
    if (!version.variantId) continue
    const list = versionsByVariantId.get(version.variantId) ?? []
    list.push(versionFromDb(version))
    versionsByVariantId.set(version.variantId, list)
  }
  for (const list of versionsByVariantId.values()) {
    list.sort((a, b) => b.versionNumber - a.versionNumber || a.id.localeCompare(b.id))
  }

  const versionIds = versionRows.map((version) => version.id)
  const formulaRowRows =
    versionIds.length === 0
      ? []
      : await db.select().from(formulaRows).where(inArray(formulaRows.versionId, versionIds))

  const rowsByVersionId = new Map<string, FormulaRow[]>()
  for (const row of formulaRowRows) {
    const list = rowsByVersionId.get(row.versionId) ?? []
    list.push(rowFromDb(row))
    rowsByVersionId.set(row.versionId, list)
  }
  for (const list of rowsByVersionId.values()) {
    list.sort((a, b) => a.sortOrder - b.sortOrder)
  }

  const variants = variantRows
    .map(variantFromDb)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id))

  for (const variant of variants) {
    const versions = (versionsByVariantId.get(variant.id) ?? []).map((version) => ({
      ...version,
      rows: rowsByVersionId.get(version.id) ?? [],
    }))
    const current = versions.find((version) => version.isCurrent) ?? versions[0] ?? null
    byProduct.get(variant.productId)?.push({
      variant,
      version: current
        ? {
            id: current.id,
            versionNumber: current.versionNumber,
            label: current.label,
            isCurrent: current.isCurrent,
            isFinal: current.isFinal,
            macerationStartedAt: current.macerationStartedAt,
            macerationTargetAt: current.macerationTargetAt,
            macerationNotes: current.macerationNotes,
            macerationStatus: current.macerationStatus,
          }
        : null,
      versions,
      rows: current?.rows ?? [],
    })
  }

  return byProduct
}

export async function listProductFormulas(userId: string, options?: { archived?: boolean }) {
  const organizationId = await getActiveOrganizationId(userId)
  const scope = organizationId ? eq(products.organizationId, organizationId) : eq(products.userId, userId)
  const rows = await db
    .select()
    .from(products)
    .where(
      and(scope, options?.archived ? eq(products.status, 'archived') : ne(products.status, 'archived')),
    )
    .orderBy(desc(products.updatedAt))

  const formulas = await loadCurrentVariantFormulas(rows.map((row) => row.id))
  return rows.map((row) => {
    const variants = formulas.get(row.id) ?? []
    return {
      product: {
        ...productFromRow(row),
        stage: stageFromVariants(variants),
      },
      variants,
    }
  })
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
    sortOrder: row.sortOrder,
  }
}

export function variantFromDb(row: typeof productVariants.$inferSelect): ProductVariant {
  return {
    id: row.id,
    productId: row.productId,
    label: row.label,
    sortOrder: row.sortOrder,
    isSelectedFinal: row.isSelectedFinal,
    createdAt: row.createdAt,
  }
}

export function versionFromDb(row: typeof formulaVersions.$inferSelect): FormulaVersionSummary {
  return {
    id: row.id,
    versionNumber: row.versionNumber,
    label: row.label,
    isCurrent: row.isCurrent,
    isFinal: row.isFinal,
    macerationStartedAt: row.macerationStartedAt,
    macerationTargetAt: row.macerationTargetAt,
    macerationNotes: row.macerationNotes,
    macerationStatus: computeMacerationStatus(row.macerationStartedAt, row.macerationTargetAt),
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

export function clearRulesCache() {
  cachedRules = null
}

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
  return productFromRow(product)
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

export async function listProducts(userId: string, options?: { archived?: boolean }) {
  return (await listProductFormulas(userId, options)).map((item) => item.product)
}

export async function getCurrentVersionForVariant(
  variantId: string,
  session: DatabaseSession = db,
) {
  const [version] = await session
    .select()
    .from(formulaVersions)
    .where(and(eq(formulaVersions.variantId, variantId), eq(formulaVersions.isCurrent, true)))
    .limit(1)
  return version ?? null
}

async function getFinalVersionForProduct(
  productId: string,
  session: DatabaseSession = db,
) {
  const [version] = await session
    .select()
    .from(formulaVersions)
    .where(and(eq(formulaVersions.productId, productId), eq(formulaVersions.isFinal, true)))
    .limit(1)
  return version ?? null
}

async function getActiveVersion(productId: string, variantId?: string) {
  const finalVersion = await getFinalVersionForProduct(productId)
  if (finalVersion) return finalVersion
  if (variantId) return getCurrentVersionForVariant(variantId)
  const variants = await listVariants(productId)
  if (variants[0]) return getCurrentVersionForVariant(variants[0].id)
  return null
}

export async function getFormulaRows(
  versionId: string,
  session: DatabaseSession = db,
): Promise<FormulaRow[]> {
  const rows = await session
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
  session: DatabaseSession = db,
  extras?: {
    isSelectedFinal?: boolean
    macerationStartedAt?: string | null
    macerationTargetAt?: string | null
    macerationNotes?: string | null
    versionLabel?: string
  },
) {
  const now = new Date().toISOString()
  const variantId = crypto.randomUUID()
  const versionId = crypto.randomUUID()

  await session.insert(productVariants).values({
    id: variantId,
    productId,
    label,
    sortOrder,
    isSelectedFinal: extras?.isSelectedFinal ?? false,
    createdAt: now,
  })

  await session.insert(formulaVersions).values({
    id: versionId,
    productId,
    variantId,
    versionNumber: 1,
    label: extras?.versionLabel ?? 'v1',
    isCurrent: true,
    macerationStartedAt: extras?.macerationStartedAt ?? null,
    macerationTargetAt: extras?.macerationTargetAt ?? null,
    macerationNotes: extras?.macerationNotes ?? null,
    createdAt: now,
  })

  if (rows.length > 0) {
    await saveFormulaRows(versionId, rows, session)
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
  /** When set (e.g. MCP grant), create in that org instead of the user's active workspace. */
  organizationId?: string
}) {
  const id = crypto.randomUUID()
  const now = new Date().toISOString()
  let organizationId = input.organizationId ?? null
  if (organizationId) {
    const member = await getMembership(organizationId, input.userId)
    if (!member) throw new Error('No access to this workspace')
  } else {
    organizationId = await getActiveOrganizationId(input.userId)
  }
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
    [],
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

export async function setProductArchived(productId: string, userId: string, archived: boolean) {
  await requireWritableProduct(db, productId, userId)
  const now = new Date().toISOString()
  await db
    .update(products)
    .set({
      status: archived ? 'archived' : 'draft',
      ...(archived ? { pinnedAt: null } : {}),
      updatedAt: now,
    })
    .where(eq(products.id, productId))

  return getWorkspace(productId, userId)
}

function copyProductName(name: string) {
  const suffix = ' (copy)'
  if (name.length + suffix.length <= 120) return `${name}${suffix}`
  return `${name.slice(0, 120 - suffix.length)}${suffix}`
}

export async function duplicateProduct(productId: string, userId: string, name?: string) {
  await requireWritableProduct(db, productId, userId)
  const source = await getProductForUser(productId, userId)
  if (!source) return null

  const copiedVariants = (await loadCurrentVariantFormulas([productId])).get(productId) ?? []

  const newId = crypto.randomUUID()
  const now = new Date().toISOString()
  const nextName = (name?.trim() || copyProductName(source.name)).slice(0, 120)

  await db.transaction(async (tx) => {
    await tx.insert(products).values({
      id: newId,
      userId: source.userId,
      organizationId: source.organizationId,
      name: nextName,
      type: source.type,
      markets: JSON.stringify(source.markets),
      brief: source.brief,
      claims: JSON.stringify(source.claims),
      status: 'draft',
      createdAt: now,
      updatedAt: now,
    })

    for (const { variant, version, rows } of copiedVariants) {
      await createVariantWithVersion(
        newId,
        variant.label,
        variant.sortOrder,
        rows.map((row) => ({ ...row, id: crypto.randomUUID() })),
        tx,
        {
          isSelectedFinal: variant.isSelectedFinal,
          // Duplicate copies the current version only; maceration stays with that version.
          macerationStartedAt: version?.macerationStartedAt ?? null,
          macerationTargetAt: version?.macerationTargetAt ?? null,
          macerationNotes: version?.macerationNotes ?? null,
          versionLabel: version?.label ?? 'v1',
        },
      )
    }

    await tx.insert(chatThreads).values({
      id: crypto.randomUUID(),
      productId: newId,
      mastraThreadId: crypto.randomUUID(),
      createdAt: now,
    })
  })

  await refreshDerived(newId, userId)
  const product = await getProductForUser(newId, userId)
  if (!product) throw new Error('Failed to load duplicated product')
  return product
}

export async function deleteProduct(productId: string, userId: string) {
  await db.transaction(async (tx) => {
    await requireWritableProduct(tx, productId, userId)
    const versions = await tx
      .select({ id: formulaVersions.id })
      .from(formulaVersions)
      .where(eq(formulaVersions.productId, productId))
    await tx.delete(formulaPatches).where(eq(formulaPatches.productId, productId))
    if (versions.length > 0) {
      await tx
        .delete(formulaRows)
        .where(
          inArray(
            formulaRows.versionId,
            versions.map((version) => version.id),
          ),
        )
    }
    await tx.delete(formulaVersions).where(eq(formulaVersions.productId, productId))
    await tx.delete(productVariants).where(eq(productVariants.productId, productId))
    await tx.delete(regulatoryChecks).where(eq(regulatoryChecks.productId, productId))
    await tx.delete(chatThreads).where(eq(chatThreads.productId, productId))
    await tx.delete(products).where(eq(products.id, productId))
  })
  return true
}

export async function updateProductClaims(
  productId: string,
  userId: string,
  claims: ProductClaim[],
) {
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

export async function saveFormulaRows(
  versionId: string,
  rows: FormulaRow[],
  session: DatabaseSession = db,
) {
  await session.delete(formulaRows).where(eq(formulaRows.versionId, versionId))
  if (rows.length === 0) return
  await session.insert(formulaRows).values(
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
      sortOrder: row.sortOrder ?? index,
    })),
  )
}

async function getVersionForWrite(
  session: DatabaseSession,
  productId: string,
  versionId: string,
  variantId?: string,
) {
  const [version] = await session
    .select()
    .from(formulaVersions)
    .where(and(eq(formulaVersions.id, versionId), eq(formulaVersions.productId, productId)))
    .limit(1)
  if (!version || !version.variantId) {
    throw new ProductWriteError(404, 'not_found', 'Version not found')
  }
  if (variantId && version.variantId !== variantId) {
    throw new ProductWriteError(404, 'not_found', 'Product or variant not found')
  }
  const [variant] = await session
    .select()
    .from(productVariants)
    .where(and(eq(productVariants.id, version.variantId), eq(productVariants.productId, productId)))
    .limit(1)
  if (!variant) throw new ProductWriteError(404, 'not_found', 'Product or variant not found')
  return version
}

async function saveVersionRowsInTransaction(
  session: DatabaseSession,
  productId: string,
  versionId: string,
  userId: string,
  rows: FormulaRow[],
  variantId?: string,
) {
  await requireWritableProduct(session, productId, userId)
  const version = await getVersionForWrite(session, productId, versionId, variantId)
  const now = new Date().toISOString()
  await saveFormulaRows(version.id, rows, session)
  await session.update(products).set({ updatedAt: now }).where(eq(products.id, productId))
  return version.id
}

export async function saveVersionRows(
  productId: string,
  versionId: string,
  userId: string,
  rows: FormulaRow[],
  variantId?: string,
) {
  return db.transaction((tx) =>
    saveVersionRowsInTransaction(tx, productId, versionId, userId, rows, variantId),
  )
}

async function createVersionInTransaction(
  session: DatabaseSession,
  productId: string,
  variantId: string,
  userId: string,
  input: { copyFromVersionId?: string | null } = {},
) {
  await requireWritableProduct(session, productId, userId)
  const [variant] = await session
    .select()
    .from(productVariants)
    .where(and(eq(productVariants.id, variantId), eq(productVariants.productId, productId)))
    .limit(1)
  if (!variant) throw new ProductWriteError(404, 'not_found', 'Product or variant not found')

  const siblings = await session
    .select()
    .from(formulaVersions)
    .where(eq(formulaVersions.variantId, variantId))
  if (siblings.length === 0) throw new ProductWriteError(404, 'not_found', 'Version not found')

  let sourceRows: FormulaRow[] = []
  if (input.copyFromVersionId) {
    const source = await getVersionForWrite(session, productId, input.copyFromVersionId, variantId)
    sourceRows = (await getFormulaRows(source.id, session)).map((row) => ({
      ...row,
      id: crypto.randomUUID(),
    }))
  }

  const now = new Date().toISOString()
  const nextNumber = Math.max(...siblings.map((item) => item.versionNumber)) + 1
  const versionId = crypto.randomUUID()
  await session
    .update(formulaVersions)
    .set({ isCurrent: false })
    .where(eq(formulaVersions.variantId, variantId))

  await session.insert(formulaVersions).values({
    id: versionId,
    productId,
    variantId,
    versionNumber: nextNumber,
    label: `v${nextNumber}`,
    isCurrent: true,
    isFinal: false,
    macerationStartedAt: null,
    macerationTargetAt: null,
    macerationNotes: null,
    createdAt: now,
  })
  await saveFormulaRows(versionId, sourceRows, session)
  await session.update(products).set({ updatedAt: now }).where(eq(products.id, productId))
  return versionId
}

export async function createVersion(
  productId: string,
  variantId: string,
  userId: string,
  input: { copyFromVersionId?: string | null } = {},
) {
  return db.transaction((tx) => createVersionInTransaction(tx, productId, variantId, userId, input))
}

export async function deleteVersion(versionId: string, productId: string, userId: string) {
  await db.transaction(async (tx) => {
    await requireWritableProduct(tx, productId, userId)
    const version = await getVersionForWrite(tx, productId, versionId)

    const siblings = await tx
      .select()
      .from(formulaVersions)
      .where(eq(formulaVersions.variantId, version.variantId))
    if (siblings.length <= 1) {
      throw new ProductWriteError(409, 'last_version', 'The last version cannot be deleted')
    }

    const linkedPatches = await tx
      .select()
      .from(formulaPatches)
      .where(eq(formulaPatches.baseVersionId, versionId))
    for (const patch of linkedPatches) {
      await tx
        .update(formulaPatches)
        .set({
          baseVersionId: null,
          status: patch.status === 'pending' ? 'rejected' : patch.status,
          resolvedAt: patch.status === 'pending' ? new Date().toISOString() : patch.resolvedAt,
        })
        .where(eq(formulaPatches.id, patch.id))
    }

    await tx.delete(formulaRows).where(eq(formulaRows.versionId, versionId))
    await tx.delete(formulaVersions).where(eq(formulaVersions.id, versionId))

    if (version.isFinal) {
      await tx
        .update(productVariants)
        .set({ isSelectedFinal: false })
        .where(eq(productVariants.id, version.variantId))
    }

    if (version.isCurrent) {
      const remaining = siblings
        .filter((item) => item.id !== versionId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.versionNumber - a.versionNumber)
      const nextOpen = remaining[0]
      if (nextOpen) {
        await tx
          .update(formulaVersions)
          .set({ isCurrent: true })
          .where(eq(formulaVersions.id, nextOpen.id))
      }
    }

    await tx
      .update(products)
      .set({ updatedAt: new Date().toISOString() })
      .where(eq(products.id, productId))
  })
  return getWorkspace(productId, userId)
}

export async function setFinalVersion(versionId: string, productId: string, userId: string) {
  await db.transaction(async (tx) => {
    await requireWritableProduct(tx, productId, userId)
    const version = await getVersionForWrite(tx, productId, versionId)
    const rows = await getFormulaRows(version.id, tx)
    if (!rows.some((row) => row.inci.trim())) {
      throw new ProductWriteError(
        409,
        'empty_formula',
        'Add at least one ingredient before marking this version as final',
      )
    }

    await tx
      .update(formulaVersions)
      .set({ isFinal: false })
      .where(eq(formulaVersions.productId, productId))
    await tx.update(formulaVersions).set({ isFinal: true }).where(eq(formulaVersions.id, versionId))

    await tx
      .update(productVariants)
      .set({ isSelectedFinal: false })
      .where(eq(productVariants.productId, productId))
    await tx
      .update(productVariants)
      .set({ isSelectedFinal: true })
      .where(eq(productVariants.id, version.variantId))

    await tx
      .update(products)
      .set({ updatedAt: new Date().toISOString() })
      .where(eq(products.id, productId))
  })
  await refreshDerived(productId, userId)
  return getWorkspace(productId, userId)
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
    const source = await getVariant(input.copyFromVariantId, productId)
    if (!source) return null
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
  await db
    .update(products)
    .set({ updatedAt: new Date().toISOString() })
    .where(eq(products.id, productId))
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

export async function renameVersion(
  versionId: string,
  productId: string,
  userId: string,
  label: string,
) {
  await requireWritableProduct(db, productId, userId)
  const nextLabel = label.trim()
  if (!nextLabel) throw new ProductWriteError(409, 'invalid_label', 'Version name cannot be empty')

  const [version] = await db
    .select()
    .from(formulaVersions)
    .where(and(eq(formulaVersions.id, versionId), eq(formulaVersions.productId, productId)))
    .limit(1)
  if (!version) throw new ProductWriteError(404, 'not_found', 'Version not found')

  await db
    .update(formulaVersions)
    .set({ label: nextLabel })
    .where(eq(formulaVersions.id, versionId))
  await db
    .update(products)
    .set({ updatedAt: new Date().toISOString() })
    .where(eq(products.id, productId))

  return getWorkspace(productId, userId)
}

async function clearMacerationForProduct(session: DatabaseSession, productId: string) {
  await session
    .update(formulaVersions)
    .set({
      macerationStartedAt: null,
      macerationTargetAt: null,
      macerationNotes: null,
    })
    .where(eq(formulaVersions.productId, productId))
}

export async function updateProductType(productId: string, userId: string, type: ProductType) {
  await requireWritableProduct(db, productId, userId)
  const product = await getProductForUser(productId, userId)
  if (!product) return null

  const leavingPerfume =
    productTracksMaceration(product.type) && !productTracksMaceration(type)

  await db.transaction(async (tx) => {
    await tx
      .update(products)
      .set({ type, updatedAt: new Date().toISOString() })
      .where(eq(products.id, productId))
    // Perfume → skincare/hybrid: wipe stored maceration, do not leave hidden data.
    if (leavingPerfume) await clearMacerationForProduct(tx, productId)
  })

  return getWorkspace(productId, userId)
}

export async function setSelectedFinalVariant(
  productId: string,
  variantId: string,
  userId: string,
) {
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
  versionId: string,
  productId: string,
  userId: string,
  input: {
    macerationStartedAt?: string | null
    macerationTargetAt?: string | null
    macerationNotes?: string | null
  },
) {
  await requireWritableProduct(db, productId, userId)
  const product = await getProductForUser(productId, userId)
  if (!product) return null
  if (!productTracksMaceration(product.type)) {
    throw new Error('Maceration is only tracked for perfumes')
  }

  const [version] = await db
    .select()
    .from(formulaVersions)
    .where(and(eq(formulaVersions.id, versionId), eq(formulaVersions.productId, productId)))
    .limit(1)
  if (!version) throw new ProductWriteError(404, 'not_found', 'Version not found')

  await db
    .update(formulaVersions)
    .set({
      macerationStartedAt: input.macerationStartedAt ?? null,
      macerationTargetAt: input.macerationTargetAt ?? null,
      macerationNotes: input.macerationNotes ?? null,
    })
    .where(eq(formulaVersions.id, versionId))
  await db
    .update(products)
    .set({ updatedAt: new Date().toISOString() })
    .where(eq(products.id, productId))

  return getWorkspace(productId, userId)
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

  return { inci: generateInciList(rows), checks }
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
  baseVersionId: string
}) {
  const id = crypto.randomUUID()
  const now = new Date().toISOString()
  await db.insert(formulaPatches).values({
    id,
    productId: input.productId,
    variantId: input.variantId,
    baseVersionId: input.baseVersionId,
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
  const resolved = await db.transaction(async (tx) => {
    await requireWritableProduct(tx, productId, userId)
    const [patch] = await tx
      .select()
      .from(formulaPatches)
      .where(and(eq(formulaPatches.id, patchId), eq(formulaPatches.productId, productId)))
      .limit(1)
    if (!patch || patch.status !== 'pending') return false

    if (action === 'accepted') {
      if (!patch.variantId || !patch.baseVersionId) {
        throw new ProductWriteError(
          409,
          'formula_conflict',
          'Ask for a new proposal based on the current formula',
        )
      }
      const version = await getVersionForWrite(tx, productId, patch.baseVersionId, patch.variantId)
      const currentRows = await getFormulaRows(version.id, tx)
      const operations = parseJson<PatchOperation[]>(patch.operations, [])
      const nextRows = applyPatchOperations(currentRows, operations)
      await saveVersionRowsInTransaction(tx, productId, version.id, userId, nextRows, patch.variantId)
    }
    await tx
      .update(formulaPatches)
      .set({ status: action, resolvedAt: new Date().toISOString() })
      .where(eq(formulaPatches.id, patchId))
    return true
  })
  if (!resolved) return null
  if (action === 'accepted') await refreshDerived(productId, userId)

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

  const variants =
    (await loadCurrentVariantFormulas([productId], { allVersions: true })).get(productId) ?? []
  const selectedFinalVariantId = variants.find((item) => item.variant.isSelectedFinal)?.variant.id ?? null
  const selectedFinalVersionId =
    variants.flatMap((item) => item.versions).find((version) => version.isFinal)?.id ?? null

  const [checks, thread] = await Promise.all([
    db.select().from(regulatoryChecks).where(eq(regulatoryChecks.productId, productId)),
    getChatThread(productId),
  ])

  const activeVariantId = selectedFinalVariantId ?? variants[0]?.variant.id ?? null
  const patches = await listPatches(productId)

  return {
    product,
    stage: stageFromVariants(variants),
    variants,
    selectedFinalVariantId,
    selectedFinalVersionId,
    activeVariantId,
    patches,
    checks: checks.map((check) => ({
      market: check.market,
      status: check.status,
      hits: parseJson(check.hits, []),
      checkedAt: check.checkedAt,
    })),
    thread,
  }
}
