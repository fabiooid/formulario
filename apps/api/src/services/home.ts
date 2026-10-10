import {
  collectPurchaseSuggestions,
  computeFormulaCostPerKg,
  computeShelfSnapshot,
  evaluateClaimHits,
  formulaPercentTotal,
  isPercentBalanced,
  runRegulatoryChecks,
  versionDisplayLabel,
  type IngredientOriginType,
  type IngredientRule,
  type ProductClaim,
  type PurchaseSuggestion,
  type TriStateFlag,
} from '@formulario/domain'
import { listProductFormulas, loadRules } from './products.js'
import { listIngredients } from './ingredients.js'

export type HomeAttentionKind =
  | 'banned'
  | 'restricted'
  | 'claim_block'
  | 'unbalanced'
  | 'maceration_ready'
  | 'macerating'

export type HomeAtRiskKind = 'banned' | 'missing_ingredient' | 'stock_out'

export type HomeAttention = {
  id: string
  kind: HomeAttentionKind
  href: string
  productName: string
  /** Version display name (versions-only UI). */
  versionLabel?: string
  versionId?: string
  inci?: string
  claim?: ProductClaim
  daysLeft?: number
  daysRested?: number
  macerationProgress?: number | null
  totalPercent?: number
}

/** One concrete cause for a product being at risk (plain-language fields for i18n). */
export type HomeAtRiskReason = {
  kind: HomeAtRiskKind
  inci: string
  /** Market code when kind is banned (e.g. EU). */
  market?: string
  /** Official list / instrument label (e.g. Annex II). */
  instrument?: string
  /** Grams on hand when known (low stock). */
  onHandGrams?: number | null
  /** Share of the active/final formula, when known. */
  formulaPercent?: number
}

export type HomeAtRisk = {
  id: string
  /** Highest-severity reason kind (for icon / sort). */
  kind: HomeAtRiskKind
  href: string
  productName: string
  reasons: HomeAtRiskReason[]
}

export type HomeFormulaCost = {
  productId: string
  productName: string
  versionLabel: string
  href: string
  costPerKg: number | null
  pricedPercent: number
  hasGap: boolean
  balanced: boolean
  /** Fully priced and balanced near 100%. */
  fullCost: boolean
}

export type HomePurchaseSuggestion = PurchaseSuggestion & {
  onHandGrams?: number | null
}

const ATTENTION_ORDER: Record<HomeAttentionKind, number> = {
  banned: 0,
  claim_block: 1,
  maceration_ready: 2,
  unbalanced: 3,
  restricted: 4,
  macerating: 5,
}

const AT_RISK_ORDER: Record<HomeAtRiskKind, number> = {
  banned: 0,
  missing_ingredient: 1,
  stock_out: 2,
}

type HomeRow = { inci: string; percent: number; phase?: string }

type HomeVersion = {
  id: string
  label?: string | null
  versionNumber: number
  isFinal: boolean
  isCurrent: boolean
  macerationStatus?: 'fresh' | 'macerating' | 'ready' | null
  macerationStartedAt?: string | null
  macerationTargetAt?: string | null
  rows: HomeRow[]
}

type HomeVariant = {
  variant: { id: string; label: string; isSelectedFinal: boolean }
  version: {
    id: string
    label?: string | null
    versionNumber: number
    isFinal: boolean
    macerationStatus?: 'fresh' | 'macerating' | 'ready' | null
    macerationStartedAt?: string | null
    macerationTargetAt?: string | null
  } | null
  rows: HomeRow[]
  versions: HomeVersion[]
}

type HomeProductCatalogItem = {
  product: {
    id: string
    name: string
    type: 'skincare' | 'perfume' | 'hybrid'
    markets: string[]
    claims: ProductClaim[]
  }
  variants: HomeVariant[]
}

type HomeInventoryItem = {
  inci: string
  stockStatus: 'in_house' | 'low' | 'to_buy'
  pricePerKg?: number | null
  onHandGrams?: number | null
  category?: string
  animalDerived?: TriStateFlag
  originType?: IngredientOriginType
  organicCertified?: TriStateFlag
}

export function daysUntil(iso?: string | null, now = Date.now()) {
  if (!iso) return undefined
  return Math.ceil((new Date(iso).getTime() - now) / 86_400_000)
}

export function daysSince(iso?: string | null, now = Date.now()) {
  if (!iso) return undefined
  return Math.max(0, Math.floor((now - new Date(iso).getTime()) / 86_400_000))
}

/** Progress from start to target (0-1). Null when dates are missing or inverted. */
export function macerationProgress(
  startedAt?: string | null,
  targetAt?: string | null,
  now = Date.now(),
): number | null {
  if (!startedAt || !targetAt) return null
  const start = new Date(startedAt).getTime()
  const target = new Date(targetAt).getTime()
  if (!(target > start)) return null
  return Math.min(1, Math.max(0, (now - start) / (target - start)))
}

export function pickVisibleVariant<T extends { variant: { isSelectedFinal: boolean } }>(
  variants: T[],
): T | null {
  if (!variants.length) return null
  return variants.find((item) => item.variant.isSelectedFinal) ?? variants[0] ?? null
}

export function pickCostVariant<
  T extends {
    variant: { label: string }
    version: { label?: string | null; versionNumber: number } | null
    rows: HomeRow[]
    versions: Array<{
      label?: string | null
      versionNumber: number
      isFinal: boolean
      rows: HomeRow[]
    }>
  },
>(variants: T[]) {
  for (const item of variants) {
    const finalVersion = item.versions.find(
      (version) => version.isFinal && version.rows.some((row) => row.inci.trim()),
    )
    if (finalVersion) {
      return {
        versionLabel: versionDisplayLabel(finalVersion),
        rows: finalVersion.rows,
        balanced: isPercentBalanced(finalVersion.rows),
      }
    }
  }
  const withRows = variants.filter((item) => item.rows.some((row) => row.inci.trim()))
  if (!withRows.length) return null
  const picked = withRows[0]
  return {
    versionLabel: picked.version
      ? versionDisplayLabel(picked.version)
      : picked.variant.label,
    rows: picked.rows,
    balanced: isPercentBalanced(picked.rows),
  }
}

/** Active working formula: final if set, otherwise the visible variant's current rows. */
export function pickActiveFormulaRows(variants: HomeVariant[]): HomeRow[] {
  const finalVersion = variants
    .flatMap((item) => item.versions)
    .find((version) => version.isFinal && version.rows.some((row) => row.inci.trim()))
  if (finalVersion) return finalVersion.rows
  const visible = pickVisibleVariant(variants)
  if (!visible) return []
  if (visible.rows.some((row) => row.inci.trim())) return visible.rows
  const withRows = visible.versions.find((version) => version.rows.some((row) => row.inci.trim()))
  return withRows?.rows ?? []
}

function shortInstrument(instrument: string) {
  const trimmed = instrument.trim()
  // Keep the annex / list name short for Home copy (e.g. "EU Annex II" -> "Annex II").
  return trimmed.replace(/^(EU|UK|US|HK|ASEAN)\s+/i, '').trim() || trimmed
}

function productHref(
  productId: string,
  options?: { versionId?: string; tab?: 'workspace' | 'regulatory' },
) {
  const params = new URLSearchParams()
  if (options?.versionId) params.set('version', options.versionId)
  if (options?.tab) params.set('tab', options.tab)
  const query = params.toString()
  return query ? `/products/${productId}?${query}` : `/products/${productId}`
}

function reasonSortKey(kind: HomeAtRiskKind) {
  return AT_RISK_ORDER[kind]
}

export function buildHomeDashboard(input: {
  catalog: HomeProductCatalogItem[]
  inventory: HomeInventoryItem[]
  rules: IngredientRule[]
  now?: number
}) {
  const now = input.now ?? Date.now()
  const usedIngredients: Array<{ inci: string; productName: string }> = []
  const attention: HomeAttention[] = []
  const atRisk: HomeAtRisk[] = []
  const seenAttention = new Set<string>()
  const formulaCosts: HomeFormulaCost[] = []

  function pushAttention(item: HomeAttention) {
    const key = `${item.kind}:${item.href}:${item.inci ?? item.versionLabel ?? item.totalPercent ?? ''}`
    if (seenAttention.has(key)) return
    seenAttention.add(key)
    attention.push(item)
  }

  for (const { product, variants } of input.catalog) {
    const baseHref = `/products/${product.id}`
    const visible = pickVisibleVariant(variants)
    const finalVersion = variants
      .flatMap((item) => item.versions)
      .find((version) => version.isFinal && version.rows.some((row) => row.inci.trim()))
    const finalRows = finalVersion?.rows
    const activeRows = pickActiveFormulaRows(variants)
    const productReasons: HomeAtRiskReason[] = []

    for (const row of activeRows) {
      if (row.inci.trim()) usedIngredients.push({ inci: row.inci, productName: product.name })
    }

    // Maceration only for versions the maker can open in the versions-only UI
    // (versions on the visible / selected-final variant).
    if (product.type === 'perfume' && visible) {
      for (const version of visible.versions) {
        const versionLabel = versionDisplayLabel(version)
        const href = productHref(product.id, { versionId: version.id })
        if (version.macerationStatus === 'ready') {
          pushAttention({
            id: `ready-${version.id}`,
            kind: 'maceration_ready',
            href,
            productName: product.name,
            versionLabel,
            versionId: version.id,
            daysRested: daysSince(version.macerationStartedAt, now),
            macerationProgress: macerationProgress(
              version.macerationStartedAt,
              version.macerationTargetAt,
              now,
            ),
          })
        } else if (version.macerationStatus === 'macerating') {
          pushAttention({
            id: `macerating-${version.id}`,
            kind: 'macerating',
            href,
            productName: product.name,
            versionLabel,
            versionId: version.id,
            daysLeft: daysUntil(version.macerationTargetAt, now),
            daysRested: daysSince(version.macerationStartedAt, now),
            macerationProgress: macerationProgress(
              version.macerationStartedAt,
              version.macerationTargetAt,
              now,
            ),
          })
        }
      }
    }

    // Unbalanced: final when set, else the visible working version.
    const balanceRows = finalRows ?? (visible?.rows.some((row) => row.inci.trim()) ? visible.rows : [])
    const balanceVersion =
      finalVersion ??
      (visible?.version
        ? {
            id: visible.version.id,
            label: visible.version.label,
            versionNumber: visible.version.versionNumber,
          }
        : null)
    if (balanceRows.some((row) => row.inci.trim()) && !isPercentBalanced(balanceRows)) {
      pushAttention({
        id: `unbalanced-${product.id}`,
        kind: 'unbalanced',
        href: balanceVersion
          ? productHref(product.id, { versionId: balanceVersion.id })
          : baseHref,
        productName: product.name,
        versionLabel: balanceVersion ? versionDisplayLabel(balanceVersion) : undefined,
        versionId: balanceVersion?.id,
        totalPercent: formulaPercentTotal(balanceRows),
      })
    }

    // Ban / claim: only after a final version exists (same story as Regulatory).
    if (finalRows?.some((row) => row.inci.trim())) {
      const checks = runRegulatoryChecks({
        rows: finalRows.map((row) => ({
          inci: row.inci,
          percent: row.percent,
          phase: row.phase ?? 'Other',
        })),
        markets: product.markets as Array<'EU' | 'ASEAN' | 'US'>,
        productType: product.type,
        rules: input.rules,
      })
      const seenBanInci = new Set<string>()
      for (const check of checks) {
        for (const hit of check.hits) {
          if (hit.effect === 'cannot_sell') {
            const key = hit.inci.trim().toLowerCase()
            if (!seenBanInci.has(key)) {
              seenBanInci.add(key)
              productReasons.push({
                kind: 'banned',
                inci: hit.inci,
                market: hit.market,
                instrument: shortInstrument(hit.instrument),
              })
            }
          }
          if (hit.effect === 'reduce_percent') {
            pushAttention({
              id: `restricted-${product.id}-${hit.inci}`,
              kind: 'restricted',
              href: productHref(product.id, { tab: 'regulatory' }),
              productName: product.name,
              inci: hit.inci,
            })
          }
        }
      }

      const claimHits = evaluateClaimHits({
        claims: product.claims,
        rows: finalRows,
        inventory: input.inventory.map((item) => ({
          inci: item.inci,
          animalDerived: item.animalDerived ?? 'unknown',
          originType: item.originType ?? 'unknown',
          organicCertified: item.organicCertified ?? 'unknown',
        })),
      })
      for (const hit of claimHits) {
        if (hit.severity !== 'block') continue
        pushAttention({
          id: `claim-${product.id}-${hit.inci}-${hit.claim}`,
          kind: 'claim_block',
          href: baseHref,
          productName: product.name,
          inci: hit.inci,
          claim: hit.claim,
        })
      }
    }

    // Stock / missing on the active or final formula (can stack with a ban on
    // a different ingredient). Skip stock lines for an INCI already banned.
    if (activeRows.some((row) => row.inci.trim())) {
      const bannedKeys = new Set(
        productReasons
          .filter((reason) => reason.kind === 'banned')
          .map((reason) => reason.inci.trim().toLowerCase()),
      )
      const seenMissing = new Set<string>()
      const seenLow = new Set<string>()
      for (const row of activeRows) {
        const inci = row.inci.trim()
        if (!inci) continue
        const key = inci.toLowerCase()
        if (bannedKeys.has(key)) continue
        const match = input.inventory.find(
          (item) => item.inci.trim().toLowerCase() === key,
        )
        if (!match || match.stockStatus === 'to_buy') {
          if (seenMissing.has(key)) continue
          seenMissing.add(key)
          productReasons.push({
            kind: 'missing_ingredient',
            inci: match?.inci ?? inci,
            formulaPercent: row.percent,
          })
          continue
        }
        if (match.stockStatus === 'low') {
          if (seenLow.has(key)) continue
          seenLow.add(key)
          productReasons.push({
            kind: 'stock_out',
            inci: match.inci,
            onHandGrams: match.onHandGrams ?? null,
            formulaPercent: row.percent,
          })
        }
      }
    }

    if (productReasons.length) {
      productReasons.sort(
        (a, b) =>
          reasonSortKey(a.kind) - reasonSortKey(b.kind) || a.inci.localeCompare(b.inci),
      )
      const primary = productReasons[0]
      const href =
        primary.kind === 'banned'
          ? productHref(product.id, { tab: 'regulatory' })
          : finalVersion
            ? productHref(product.id, { versionId: finalVersion.id })
            : visible?.version
              ? productHref(product.id, { versionId: visible.version.id })
              : baseHref
      atRisk.push({
        id: `risk-${product.id}`,
        kind: primary.kind,
        href,
        productName: product.name,
        reasons: productReasons,
      })
    }

    const picked = pickCostVariant(variants)
    if (picked) {
      const cost = computeFormulaCostPerKg(picked.rows, input.inventory)
      const fullCost = !cost.hasGap && picked.balanced
      formulaCosts.push({
        productId: product.id,
        productName: product.name,
        versionLabel: picked.versionLabel,
        href: baseHref,
        costPerKg: cost.costPerKg,
        pricedPercent: cost.pricedPercent,
        hasGap: cost.hasGap,
        balanced: picked.balanced,
        fullCost,
      })
    }
  }

  attention.sort(
    (a, b) => ATTENTION_ORDER[a.kind] - ATTENTION_ORDER[b.kind] || a.productName.localeCompare(b.productName),
  )
  atRisk.sort(
    (a, b) => AT_RISK_ORDER[a.kind] - AT_RISK_ORDER[b.kind] || a.productName.localeCompare(b.productName),
  )
  formulaCosts.sort((a, b) => (b.costPerKg ?? 0) - (a.costPerKg ?? 0) || a.productName.localeCompare(b.productName))

  const shelf = computeShelfSnapshot(input.inventory as Parameters<typeof computeShelfSnapshot>[0])
  const purchaseBase = collectPurchaseSuggestions(usedIngredients, input.inventory, {
    includeUnused: false,
  })
  const purchaseSuggestions: HomePurchaseSuggestion[] = purchaseBase.map((item) => {
    const match = input.inventory.find(
      (inv) => inv.inci.trim().toLowerCase() === item.inci.trim().toLowerCase(),
    )
    return { ...item, onHandGrams: match?.onHandGrams ?? null }
  })

  return {
    productCount: input.catalog.length,
    shelf: {
      value: shelf.value,
      valuedCount: shelf.valuedCount,
      shelfCount: shelf.shelfCount,
      pricedCount: shelf.pricedCount,
    },
    purchaseCount: purchaseSuggestions.length,
    formulaCost: {
      completeCount: formulaCosts.filter((item) => item.fullCost).length,
      totalCount: formulaCosts.length,
    },
    purchaseSuggestions,
    attention,
    attentionTotal: attention.length,
    atRisk,
    formulaCosts,
  }
}

export async function getHomeDashboard(userId: string) {
  const catalog = await listProductFormulas(userId)
  const inventory = await listIngredients(userId)
  const rules = await loadRules()
  return buildHomeDashboard({ catalog, inventory, rules })
}
