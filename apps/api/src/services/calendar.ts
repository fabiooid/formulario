import { versionDisplayLabel } from '@formulario/domain'
import { listProductFormulas } from './products.js'
import { listIngredients } from './ingredients.js'
import { daysUntil, pickVisibleVariant } from './home.js'

export type CalendarMacerationEntry = {
  id: string
  kind: 'maceration_ready' | 'maceration_target'
  /** ISO date (YYYY-MM-DD) for the timeline when known. */
  date: string | null
  href: string
  productName: string
  versionLabel: string
  daysLeft?: number
}

export type CalendarStockEntry = {
  id: string
  kind: 'stock_low' | 'stock_to_buy'
  /** Always null: the app does not invent run-out dates. */
  date: null
  href: string
  inci: string
  stockStatus: 'low' | 'to_buy'
  onHandGrams?: number | null
  /** Honest: false until we have a real usage model. */
  canEstimateRunOut: false
}

export type CalendarDashboard = {
  maceration: CalendarMacerationEntry[]
  stock: CalendarStockEntry[]
}

function productHref(productId: string, versionId?: string) {
  return versionId ? `/products/${productId}?version=${versionId}` : `/products/${productId}`
}

function toDateKey(iso?: string | null): string | null {
  if (!iso) return null
  const parsed = new Date(iso)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed.toISOString().slice(0, 10)
}

type CalendarVersion = {
  id: string
  label?: string | null
  versionNumber: number
  macerationStatus?: 'fresh' | 'macerating' | 'ready' | null
  macerationTargetAt?: string | null
}

type CalendarVariant = {
  variant: { isSelectedFinal: boolean }
  versions: CalendarVersion[]
}

/**
 * Build calendar rows from product formulas + inventory.
 * Maceration uses the same visible-variant rule as Home.
 * Stock never invents a run-out date.
 */
export function buildCalendarDashboard(input: {
  catalog: Array<{
    product: { id: string; name: string; type: string }
    variants: CalendarVariant[]
  }>
  inventory: Array<{
    id: string
    inci: string
    stockStatus: 'in_house' | 'low' | 'to_buy'
    onHandGrams?: number | null
  }>
  now?: number
}): CalendarDashboard {
  const now = input.now ?? Date.now()
  const maceration: CalendarMacerationEntry[] = []

  for (const { product, variants } of input.catalog) {
    if (product.type !== 'perfume') continue
    const visible = pickVisibleVariant(variants)
    if (!visible) continue

    for (const version of visible.versions) {
      const versionLabel = versionDisplayLabel(version)
      const href = productHref(product.id, version.id)
      if (version.macerationStatus === 'ready') {
        maceration.push({
          id: `ready-${version.id}`,
          kind: 'maceration_ready',
          date: toDateKey(version.macerationTargetAt) ?? toDateKey(new Date(now).toISOString()),
          href,
          productName: product.name,
          versionLabel,
          daysLeft: daysUntil(version.macerationTargetAt, now),
        })
      } else if (version.macerationStatus === 'macerating') {
        maceration.push({
          id: `macerating-${version.id}`,
          kind: 'maceration_target',
          date: toDateKey(version.macerationTargetAt),
          href,
          productName: product.name,
          versionLabel,
          daysLeft: daysUntil(version.macerationTargetAt, now),
        })
      }
    }
  }

  maceration.sort((a, b) => {
    if (a.date && b.date) return a.date.localeCompare(b.date) || a.productName.localeCompare(b.productName)
    if (a.date && !b.date) return -1
    if (!a.date && b.date) return 1
    return a.productName.localeCompare(b.productName)
  })

  const stock: CalendarStockEntry[] = input.inventory
    .filter((item) => item.stockStatus === 'low' || item.stockStatus === 'to_buy')
    .map((item) => ({
      id: `stock-${item.id}`,
      kind: item.stockStatus === 'low' ? 'stock_low' : 'stock_to_buy',
      date: null,
      href: '/ingredients',
      inci: item.inci,
      stockStatus: item.stockStatus,
      onHandGrams: item.onHandGrams ?? null,
      canEstimateRunOut: false as const,
    }))
    .sort((a, b) => {
      const order = { to_buy: 0, low: 1 } as const
      return order[a.stockStatus] - order[b.stockStatus] || a.inci.localeCompare(b.inci)
    })

  return { maceration, stock }
}

export async function getCalendarDashboard(userId: string): Promise<CalendarDashboard> {
  const catalog = await listProductFormulas(userId)
  const inventory = await listIngredients(userId)
  return buildCalendarDashboard({
    catalog: catalog.map((item) => ({
      product: {
        id: item.product.id,
        name: item.product.name,
        type: item.product.type,
      },
      variants: item.variants.map((variant) => ({
        variant: { isSelectedFinal: variant.variant.isSelectedFinal },
        versions: variant.versions.map((version) => ({
          id: version.id,
          label: version.label,
          versionNumber: version.versionNumber,
          macerationStatus: version.macerationStatus,
          macerationTargetAt: version.macerationTargetAt,
        })),
      })),
    })),
    inventory: inventory.map((item) => ({
      id: item.id,
      inci: item.inci,
      stockStatus: item.stockStatus,
      onHandGrams: item.onHandGrams,
    })),
  })
}
