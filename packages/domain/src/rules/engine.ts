import type {
  FormulaRow,
  IngredientRule,
  Market,
  PatchOperation,
  ProductType,
  RegulatoryCheckResult,
  RegulatoryHit,
  RegulatoryStatus,
} from '../types.ts'
import { aggregateRowsByInci, normalizeInci } from '../types.ts'

export interface CheckInput {
  rows: Array<Pick<FormulaRow, 'inci' | 'percent' | 'phase'> & { cas?: string | null }>
  markets: Market[]
  productType: ProductType
  rules: IngredientRule[]
}

/** Instrument name on the note returned for a country with no official list loaded. */
export const NO_OFFICIAL_LIST = 'No official list'

const NO_LIST_CITATION = 'https://single-market-economy.ec.europa.eu/sectors/cosmetics/cosmetic-ingredient-database_en'

function nameKey(value: string) {
  return normalizeInci(value).replace(/\s+/g, ' ')
}

function casKey(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, '')
}

function findMatchingRules(
  row: { inci: string; cas?: string | null },
  market: Market,
  productType: ProductType,
  rules: IngredientRule[],
): IngredientRule[] {
  const normalized = nameKey(row.inci)
  const cas = row.cas ? casKey(row.cas) : ''
  return rules.filter((rule) => {
    if (rule.market !== market) return false
    // `leaveOnOnly` needs no check yet: skincare, perfume and hybrid are all leave-on products.
    // Revisit when a rinse-off product type is added.
    if (rule.productTypes && !rule.productTypes.includes(productType)) return false
    const nameMatch = rule.inciNames.some((name) => nameKey(name) === normalized)
    const casMatch = Boolean(cas && rule.casNumbers?.some((number) => casKey(number) === cas))
    return nameMatch || casMatch
  })
}

/** A ban wins, then any other hit on the loaded list. No match is "not on this list", never "allowed". */
function statusFromRuleHits(hits: RegulatoryHit[]): RegulatoryStatus {
  if (hits.some((hit) => hit.effect === 'cannot_sell')) return 'banned'
  if (hits.length > 0) return 'restricted'
  return 'not_listed'
}

export function evaluateIngredient(
  row: Pick<FormulaRow, 'inci' | 'percent' | 'phase'>,
  market: Market,
  productType: ProductType,
  rules: IngredientRule[],
): RegulatoryHit[] {
  const hits: RegulatoryHit[] = []
  const matched = findMatchingRules(row, market, productType, rules)

  if (matched.length === 0) {
    return hits
  }

  for (const rule of matched) {
    if (rule.effect === 'cannot_sell') {
      hits.push({
        market,
        instrument: rule.instrument,
        substance: rule.substance,
        inci: row.inci,
        effect: rule.effect,
        citationUrl: rule.citationUrl,
        message: rule.message,
      })
      continue
    }

    if (rule.effect === 'reduce_percent' && rule.maxPercent != null && row.percent > rule.maxPercent) {
      hits.push({
        market,
        instrument: rule.instrument,
        substance: rule.substance,
        inci: row.inci,
        limit: `${rule.maxPercent}% w/w`,
        effect: rule.effect,
        citationUrl: rule.citationUrl,
        message: `${rule.message} Current: ${row.percent}%.`,
      })
      continue
    }

    if (rule.effect === 'relabel' && rule.labelThresholdPercent != null && row.percent >= rule.labelThresholdPercent) {
      hits.push({
        market,
        instrument: rule.instrument,
        substance: rule.substance,
        inci: row.inci,
        limit: `≥ ${rule.labelThresholdPercent}% w/w`,
        effect: rule.effect,
        citationUrl: rule.citationUrl,
        message: rule.message,
      })
      continue
    }

    if (rule.effect === 'inci_wording' && rule.preferredInci) {
      if (normalizeInci(row.inci) !== normalizeInci(rule.preferredInci)) {
        hits.push({
          market,
          instrument: rule.instrument,
          substance: rule.substance,
          inci: row.inci,
          limit: `Use "${rule.preferredInci}"`,
          effect: rule.effect,
          citationUrl: rule.citationUrl,
          message: rule.message,
        })
      }
    }
  }

  return hits
}

export function runRegulatoryChecks(input: CheckInput): RegulatoryCheckResult[] {
  const { markets, productType, rules } = input
  // Limits apply to the total of an ingredient, so two rows of the same INCI are checked as one.
  const rows = aggregateRowsByInci(input.rows)

  return markets.map((market) => {
    const marketRules = rules.filter((rule) => rule.market === market)
    if (marketRules.length === 0) {
      return {
        market,
        status: 'unknown' as const,
        hits: [
          {
            market,
            instrument: NO_OFFICIAL_LIST,
            substance: market,
            inci: '',
            effect: 'relabel' as const,
            citationUrl: NO_LIST_CITATION,
            message: `No official banned-ingredient list is loaded for ${market}. This is not a check for that country.`,
          },
        ],
      }
    }

    const ruleHits: RegulatoryHit[] = []
    for (const row of rows) {
      ruleHits.push(...evaluateIngredient(row, market, productType, marketRules))
    }

    return {
      market,
      status: statusFromRuleHits(ruleHits),
      hits: ruleHits,
    }
  })
}

export function applyPatchOperations(
  rows: FormulaRow[],
  operations: PatchOperation[],
): FormulaRow[] {
  let next = [...rows].sort((a, b) => a.sortOrder - b.sortOrder)

  for (const op of operations) {
    if (op.op === 'add') {
      const id = crypto.randomUUID()
      const sortOrder = op.row.sortOrder ?? next.length
      next.push({
        id,
        inci: op.row.inci,
        cas: op.row.cas,
        tradeName: op.row.tradeName,
        function: op.row.function,
        phase: op.row.phase,
        percent: op.row.percent,
        notes: op.row.notes,
        sortOrder,
      })
    }

    if (op.op === 'update') {
      next = next.map((row) => {
        if (row.id !== op.rowId) return row
        return {
          ...row,
          ...op.changes,
          id: row.id,
        }
      })
    }

    if (op.op === 'remove') {
      next = next.filter((row) => row.id !== op.rowId)
    }

    if (op.op === 'reorder') {
      const map = new Map(next.map((row) => [row.id, row]))
      const reordered: FormulaRow[] = []
      op.rowIds.forEach((id, index) => {
        const row = map.get(id)
        if (row) reordered.push({ ...row, sortOrder: index })
      })
      const remaining = next.filter((row) => !op.rowIds.includes(row.id))
      next = [...reordered, ...remaining.map((row, i) => ({ ...row, sortOrder: reordered.length + i }))]
    }
  }

  return next.sort((a, b) => a.sortOrder - b.sortOrder)
}
