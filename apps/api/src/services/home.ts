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

export type HomeAtRisk = {
  id: string
  kind: HomeAtRiskKind
  href: string
  productName: string
  reasonInci?: string
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

function productHref(productId: string, versionId?: string) {
  return versionId ? `/products/${productId}?version=${versionId}` : `/products/${productId}`
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
  const seenAtRisk = new Set<string>()
  const formulaCosts: HomeFormulaCost[] = []
  const atRiskProductIds = new Set<string>()

  function pushAttention(item: HomeAttention) {
    const key = `${item.kind}:${item.href}:${item.inci ?? item.versionLabel ?? item.totalPercent ?? ''}`
    if (seenAttention.has(key)) return
    seenAttention.add(key)
    attention.push(item)
  }

  function pushAtRisk(item: HomeAtRisk) {
    if (atRiskProductIds.has(item.href)) return
    const key = `${item.kind}:${item.href}`
    if (seenAtRisk.has(key)) return
    seenAtRisk.add(key)
    atRiskProductIds.add(item.href)
    atRisk.push(item)
  }

  for (const { product, variants } of input.catalog) {
    const baseHref = `/products/${product.id}`
    const visible = pickVisibleVariant(variants)
    const finalVersion = variants
      .flatMap((item) => item.versions)
      .find((version) => version.isFinal && version.rows.some((row) => row.inci.trim()))
    const finalRows = finalVersion?.rows
    const activeRows = pickActiveFormulaRows(variants)

    for (const row of activeRows) {
      if (row.inci.trim()) usedIngredients.push({ inci: row.inci, productName: product.name })
    }

    // Maceration only for versions the maker can open in the versions-only UI
    // (versions on the visible / selected-final variant).
    if (product.type === 'perfume' && visible) {
      for (const version of visible.versions) {
        const versionLabel = versionDisplayLabel(version)
        const href = productHref(product.id, version.id)
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
        href: balanceVersion ? productHref(product.id, balanceVersion.id) : baseHref,
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
      let bannedInci: string | undefined
      for (const check of checks) {
        for (const hit of check.hits) {
          if (hit.effect === 'cannot_sell') {
            bannedInci ??= hit.inci
          }
          if (hit.effect === 'reduce_percent') {
            pushAttention({
              id: `restricted-${product.id}-${hit.inci}`,
              kind: 'restricted',
              href: baseHref,
              productName: product.name,
              inci: hit.inci,
            })
          }
        }
      }
      // Bans live on Formulas at risk (one line per product) so Needs attention
      // does not repeat the same issue.
      if (bannedInci) {
        pushAtRisk({
          id: `risk-banned-${product.id}`,
          kind: 'banned',
          href: baseHref,
          productName: product.name,
          reasonInci: bannedInci,
        })
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

    // Stock risk on the active / final formula (skip if already at risk from a ban).
    if (!atRiskProductIds.has(baseHref) && activeRows.some((row) => row.inci.trim())) {
      let missingInci: string | undefined
      let lowInci: string | undefined
      for (const row of activeRows) {
        const inci = row.inci.trim()
        if (!inci) continue
        const match = input.inventory.find(
          (item) => item.inci.trim().toLowerCase() === inci.toLowerCase(),
        )
        if (!match) {
          missingInci ??= inci
          continue
        }
        if (match.stockStatus === 'to_buy') missingInci ??= match.inci
        else if (match.stockStatus === 'low') lowInci ??= match.inci
      }
      if (missingInci) {
        pushAtRisk({
          id: `risk-missing-${product.id}`,
          kind: 'missing_ingredient',
          href: baseHref,
          productName: product.name,
          reasonInci: missingInci,
        })
      } else if (lowInci) {
        pushAtRisk({
          id: `risk-stock-${product.id}`,
          kind: 'stock_out',
          href: baseHref,
          productName: product.name,
          reasonInci: lowInci,
        })
      }
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
