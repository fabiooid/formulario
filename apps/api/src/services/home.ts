import {
  collectPurchaseSuggestions,
  computeFormulaCostPerKg,
  computeShelfSnapshot,
  evaluateClaimHits,
  formulaPercentTotal,
  isPercentBalanced,
  runRegulatoryChecks,
  type ProductClaim,
} from '@formulario/domain'
import {
  getCurrentVersionForVariant,
  getFormulaRows,
  listProducts,
  listVariants,
  loadRules,
} from './products.js'
import { listIngredients } from './ingredients.js'

export type HomeAttentionKind =
  | 'banned'
  | 'restricted'
  | 'claim_block'
  | 'unbalanced'
  | 'maceration_ready'
  | 'macerating'

export type HomeAttention = {
  id: string
  kind: HomeAttentionKind
  href: string
  productName: string
  variantLabel?: string
  inci?: string
  claim?: ProductClaim
  daysLeft?: number
  totalPercent?: number
}

export type HomeFormulaCost = {
  productId: string
  productName: string
  variantLabel: string
  href: string
  costPerKg: number | null
  pricedPercent: number
  hasGap: boolean
}

const ATTENTION_ORDER: Record<HomeAttentionKind, number> = {
  banned: 0,
  claim_block: 1,
  maceration_ready: 2,
  unbalanced: 3,
  restricted: 4,
  macerating: 5,
}

function daysUntil(iso?: string | null) {
  if (!iso) return undefined
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000)
}

function pickCostVariant<T extends { variant: { isSelectedFinal: boolean }; rows: Array<{ inci: string }> }>(
  variants: T[],
) {
  const withRows = variants.filter((item) => item.rows.some((row) => row.inci.trim()))
  if (!withRows.length) return null
  return withRows.find((item) => item.variant.isSelectedFinal) ?? withRows[0]
}

export async function getHomeDashboard(userId: string) {
  const products = await listProducts(userId)
  const inventory = await listIngredients(userId)
  const rules = await loadRules()

  const usedIngredients: Array<{ inci: string; productName: string }> = []
  const attention: HomeAttention[] = []
  const seenAttention = new Set<string>()
  const formulaCosts: HomeFormulaCost[] = []

  function pushAttention(item: HomeAttention) {
    const key = `${item.kind}:${item.href}:${item.inci ?? item.variantLabel ?? item.totalPercent ?? ''}`
    if (seenAttention.has(key)) return
    seenAttention.add(key)
    attention.push(item)
  }

  for (const product of products) {
    const href = `/products/${product.id}`
    const variants = await listVariants(product.id)
    const workspaces = []

    for (const variant of variants) {
      const version = await getCurrentVersionForVariant(variant.id)
      const rows = version ? await getFormulaRows(version.id) : []
      workspaces.push({ variant, rows })

      for (const row of rows) {
        if (row.inci.trim()) usedIngredients.push({ inci: row.inci, productName: product.name })
      }

      if (variant.macerationStatus === 'ready') {
        pushAttention({
          id: `ready-${variant.id}`,
          kind: 'maceration_ready',
          href,
          productName: product.name,
          variantLabel: variant.label,
        })
      } else if (variant.macerationStatus === 'macerating') {
        pushAttention({
          id: `macerating-${variant.id}`,
          kind: 'macerating',
          href,
          productName: product.name,
          variantLabel: variant.label,
          daysLeft: daysUntil(variant.macerationTargetAt),
        })
      }

      if (rows.some((row) => row.inci.trim()) && !isPercentBalanced(rows)) {
        pushAttention({
          id: `unbalanced-${variant.id}`,
          kind: 'unbalanced',
          href,
          productName: product.name,
          variantLabel: variant.label,
          totalPercent: formulaPercentTotal(rows),
        })
      }

      const checks = runRegulatoryChecks({
        rows,
        markets: product.markets,
        productType: product.type,
        rules,
      })
      for (const check of checks) {
        for (const hit of check.hits) {
          if (hit.effect === 'cannot_sell') {
            pushAttention({
              id: `banned-${product.id}-${hit.inci}`,
              kind: 'banned',
              href,
              productName: product.name,
              inci: hit.inci,
            })
          }
          if (hit.effect === 'reduce_percent') {
            pushAttention({
              id: `restricted-${product.id}-${hit.inci}`,
              kind: 'restricted',
              href,
              productName: product.name,
              inci: hit.inci,
            })
          }
        }
      }

      const claimHits = evaluateClaimHits({
        claims: product.claims,
        rows,
        inventory,
      })
      for (const hit of claimHits) {
        if (hit.severity !== 'block') continue
        pushAttention({
          id: `claim-${product.id}-${hit.inci}-${hit.claim}`,
          kind: 'claim_block',
          href,
          productName: product.name,
          inci: hit.inci,
          claim: hit.claim,
        })
      }
    }

    const picked = pickCostVariant(workspaces)
    if (picked) {
      const cost = computeFormulaCostPerKg(picked.rows, inventory)
      formulaCosts.push({
        productId: product.id,
        productName: product.name,
        variantLabel: picked.variant.label,
        href,
        costPerKg: cost.costPerKg,
        pricedPercent: cost.pricedPercent,
        hasGap: cost.hasGap,
      })
    }
  }

  attention.sort(
    (a, b) => ATTENTION_ORDER[a.kind] - ATTENTION_ORDER[b.kind] || a.productName.localeCompare(b.productName),
  )
  formulaCosts.sort((a, b) => (b.costPerKg ?? 0) - (a.costPerKg ?? 0) || a.productName.localeCompare(b.productName))

  const shelf = computeShelfSnapshot(inventory)
  const purchaseSuggestions = collectPurchaseSuggestions(usedIngredients, inventory)

  return {
    shelf: {
      value: shelf.value,
      valuedCount: shelf.valuedCount,
      shelfCount: shelf.shelfCount,
      pricedCount: shelf.pricedCount,
    },
    purchaseCount: purchaseSuggestions.length,
    formulaCost: {
      completeCount: formulaCosts.filter((item) => !item.hasGap).length,
      totalCount: formulaCosts.length,
    },
    purchaseSuggestions,
    attention: attention.slice(0, 8),
    formulaCosts,
  }
}
