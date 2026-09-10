import type {
  IngredientOriginType,
  IngredientRule,
  IngredientStockStatus,
  Market,
  ProductClaim,
  ProductType,
  TriStateFlag,
} from '../types.ts'
import { formulaPercentTotal, isWaterInci, normalizeInci } from '../types.ts'
import { evaluateClaimHits } from '../claims/engine.ts'
import { runRegulatoryChecks } from '../rules/engine.ts'
import { MATERIAL_ROLE_LABELS, findMaterial, findOnShelf, type Material, type MaterialRole } from './materials.ts'
import { getSkeleton, type FormulationFormat, type Skeleton } from './skeletons.ts'

/**
 * The gate between "the model wrote some rows" and "a card appears on the table".
 * A draft that fails a block issue is sent back to the model with the reasons.
 * Warnings travel with the proposal so the person sees them.
 */

export type DraftRow = {
  inci: string
  function: string
  phase: string
  percent: number
  notes?: string
}

export type DraftInventoryItem = {
  inci: string
  stockStatus: IngredientStockStatus
  animalDerived: TriStateFlag
  originType: IngredientOriginType
  organicCertified: TriStateFlag
}

export type DraftIssueSeverity = 'block' | 'warn'

export type DraftIssueCode =
  | 'total_not_100'
  | 'too_few_rows'
  | 'role_missing'
  | 'role_too_few_rows'
  | 'role_below_band'
  | 'role_above_band'
  | 'unknown_material'
  | 'above_max'
  | 'above_typical'
  | 'below_typical'
  | 'zero_percent'
  | 'water_in_anhydrous'
  | 'preservative_not_needed'
  | 'fragrance_blob_in_perfume'
  | 'phase_unclear'
  | 'duplicate_inci'
  | 'regulatory'
  | 'claim'

export type DraftIssue = {
  severity: DraftIssueSeverity
  code: DraftIssueCode
  message: string
  inci?: string
  role?: MaterialRole
}

export type DraftRoleStatus = {
  role: MaterialRole
  label: string
  requirement: Skeleton['roles'][number]['requirement']
  status: 'filled' | 'missing'
  percent: number
  rows: string[]
}

export type DraftReport = {
  ok: boolean
  format: FormulationFormat
  formatLabel: string
  total: number
  rowCount: number
  issues: DraftIssue[]
  roles: DraftRoleStatus[]
  /** Aroma materials and preservatives that must be named on the EU label. */
  allergens: string[]
  /** Rows not on the shelf, or low / marked to buy. Informational; never blocks. */
  toOrder: Array<{ inci: string; reason: 'missing' | 'low' | 'to_buy' }>
}

export type CheckDraftInput = {
  rows: DraftRow[]
  format: FormulationFormat
  productType: ProductType
  markets: Market[]
  claims?: ProductClaim[]
  rules?: IngredientRule[]
  inventory?: DraftInventoryItem[]
}

const FUNCTION_ROLE_PATTERNS: Array<[RegExp, MaterialRole]> = [
  [/preservative\s*booster|booster/, 'preservative_booster'],
  [/preserv/, 'preservative'],
  [/co-?emulsifier|consistency|structur|fatty alcohol|stabili[sz]er/, 'co_emulsifier'],
  [/emulsif/, 'emulsifier'],
  [/solubili/, 'solubilizer'],
  [/chelat/, 'chelator'],
  [/\bph\b|buffer|neutrali/, 'ph_adjuster'],
  [/antioxidant|anti-oxidant|rancid/, 'antioxidant'],
  [/gum|gelling|gellant|thicken|viscosity|rheology/, 'thickener'],
  [/humectant|hydrat/, 'humectant'],
  [/fixative/, 'fixative'],
  [/allergen|aroma|top note|heart note|base note|middle note|essential oil|absolute|resinoid|fragrance material|perfume material|note\b/, 'aroma_material'],
  [/fragrance|parfum|perfume|scent/, 'fragrance_compound'],
  [/colou?r|pigment|dye/, 'colorant'],
  [/\bwax\b/, 'wax'],
  [/butter/, 'butter'],
  [/carrier/, 'carrier'],
  [/solvent|diluent|alcohol/, 'solvent'],
  [/emollient|\boil\b|ester|lipid|occlusive/, 'emollient'],
  [/active|soothing|barrier|vitamin|extract|conditioning|brighten|exfoliat|anti-?aging|ceramide|peptide/, 'active'],
  [/water|aqua|solvent/, 'water'],
]

function roleFromFunctionText(text: string): MaterialRole | undefined {
  const lower = text.toLowerCase()
  for (const [pattern, role] of FUNCTION_ROLE_PATTERNS) {
    if (pattern.test(lower)) return role
  }
  return undefined
}

function isWaterRow(row: DraftRow, material?: Material) {
  return isWaterInci(row.inci) || Boolean(material?.roles.includes('water'))
}

/**
 * Decide which skeleton role a row fills. The library wins when it knows the material;
 * the row's function text is the fallback (and the tie-breaker for multi-role materials).
 */
export function attributeRole(
  row: DraftRow,
  skeleton: Skeleton,
  material: Material | undefined,
): MaterialRole | undefined {
  const skeletonRoles = new Set(skeleton.roles.map((item) => item.role))
  const textRole = roleFromFunctionText(row.function)

  if (isWaterInci(row.inci)) return 'water'

  if (material) {
    if (textRole && skeletonRoles.has(textRole) && material.roles.includes(textRole)) return textRole
    const inSkeleton = material.roles.find((role) => skeletonRoles.has(role))
    if (inSkeleton) return inSkeleton
    return material.roles[0]
  }

  return textRole
}

function stockReason(item: DraftInventoryItem | undefined): 'missing' | 'low' | 'to_buy' | null {
  if (!item) return 'missing'
  if (item.stockStatus === 'low') return 'low'
  if (item.stockStatus === 'to_buy') return 'to_buy'
  return null
}

function phaseMatches(phase: string, skeleton: Skeleton) {
  const value = phase.trim().toLowerCase()
  if (!value) return false
  return skeleton.phases.some((item) => {
    const code = item.code.toLowerCase()
    if (value === code) return true
    if (value.startsWith(`${code} `) || value.startsWith(`${code}-`) || value.startsWith(`${code}—`) || value.startsWith(`${code}:`) || value.startsWith(`${code}.`)) return true
    return item.label.toLowerCase().split(/[\s/]+/).some((word) => word.length > 3 && value.includes(word))
  })
}

export function checkFormulaDraft(input: CheckDraftInput): DraftReport {
  const skeleton = getSkeleton(input.format)
  const issues: DraftIssue[] = []
  const rows = input.rows.filter((row) => row.inci.trim())
  const inventory = input.inventory ?? []
  const isPerfume = skeleton.productType === 'perfume'

  const total = formulaPercentTotal(rows)
  if (Math.abs(total - 100) > 0.5) {
    const balanceRow = [...rows]
      .filter((row) => attributeRole(row, skeleton, findMaterial(row.inci)) === skeleton.balanceRole)
      .sort((a, b) => b.percent - a.percent)[0]
    const suggested = balanceRow ? Math.round((balanceRow.percent + (100 - total)) * 100) / 100 : null
    issues.push({
      severity: 'block',
      code: 'total_not_100',
      message:
        `Rows add up to ${total}%, not 100%.` +
        (balanceRow && suggested != null && suggested > 0
          ? ` Set ${balanceRow.inci} to ${suggested}% and keep every other row as it is.`
          : ` Use the ${MATERIAL_ROLE_LABELS[skeleton.balanceRole].toLowerCase()} row as the balance so the total is exactly 100.`),
    })
  }

  if (rows.length < skeleton.rows[0]) {
    issues.push({
      severity: 'block',
      code: 'too_few_rows',
      message: `${rows.length} rows is too short for a ${skeleton.label.toLowerCase()}. A usable one has ${skeleton.rows[0]}–${skeleton.rows[1]} rows, one per material.`,
    })
  }

  // Row-level checks and role attribution.
  const roleRows = new Map<MaterialRole, DraftRow[]>()
  const fixativeRows: string[] = []
  const allergens = new Set<string>()
  const toOrder: DraftReport['toOrder'] = []
  const seen = new Map<string, number>()
  let hasWater = false
  let hasPreservative = false

  for (const row of rows) {
    const material = findMaterial(row.inci)
    const inventoryItem = findOnShelf(row.inci, inventory, material)
    const key = normalizeInci(row.inci)
    seen.set(key, (seen.get(key) ?? 0) + 1)

    if (row.percent <= 0) {
      issues.push({ severity: 'block', code: 'zero_percent', inci: row.inci, message: `${row.inci} has no percent. Give every row a real amount.` })
    }

    if (!material && !inventoryItem && !isWaterInci(row.inci)) {
      const textRole = roleFromFunctionText(row.function)
      const aromaInPerfume = isPerfume && (textRole === 'aroma_material' || textRole === 'fixative')
      issues.push({
        severity: aromaInPerfume ? 'warn' : 'block',
        code: 'unknown_material',
        inci: row.inci,
        message: aromaInPerfume
          ? `${row.inci} is not in the materials library. Keep it only if it is a real INCI name for an aroma material; otherwise pick one from search_materials.`
          : `${row.inci} is not in the materials library or on the shelf. Use the exact INCI of a library material (search_materials) — do not invent names.`,
      })
    }

    if (material) {
      const [low, high] = material.typical
      if (material.max != null && row.percent > material.max) {
        issues.push({ severity: 'block', code: 'above_max', inci: row.inci, message: `${row.inci} at ${row.percent}% is above its ceiling of ${material.max}%.` })
      } else if (row.percent > high) {
        issues.push({ severity: 'warn', code: 'above_typical', inci: row.inci, message: `${row.inci} at ${row.percent}% is above its usual band (${low}–${high}%).` })
      } else if (row.percent > 0 && row.percent < low) {
        issues.push({ severity: 'warn', code: 'below_typical', inci: row.inci, message: `${row.inci} at ${row.percent}% is below its usual band (${low}–${high}%) and may not do its job.` })
      }
      if (material.allergen) allergens.add(material.inci)
      if (material.roles.includes('fixative')) fixativeRows.push(row.inci)
      if (material.roles.includes('preservative')) hasPreservative = true
      if (isPerfume && material.roles.includes('fragrance_compound')) {
        issues.push({
          severity: 'block',
          code: 'fragrance_blob_in_perfume',
          inci: row.inci,
          message: `A perfume formula lists its aroma materials one per row, not a single "${row.inci}" row. Replace it with the individual materials.`,
        })
      }
    }

    if (isWaterRow(row, material)) hasWater = true
    const textRole = roleFromFunctionText(row.function)
    if (textRole === 'preservative') hasPreservative = true
    if (textRole === 'fixative') fixativeRows.push(row.inci)

    if (!phaseMatches(row.phase, skeleton)) {
      issues.push({
        severity: 'warn',
        code: 'phase_unclear',
        inci: row.inci,
        message: `Phase "${row.phase}" for ${row.inci} does not match this format. Use ${skeleton.phases.map((phase) => `${phase.code} (${phase.label})`).join(', ')}.`,
      })
    }

    const reason = stockReason(inventoryItem)
    if (reason && !isWaterInci(row.inci)) toOrder.push({ inci: row.inci, reason })

    const role = attributeRole(row, skeleton, material)
    if (role) {
      const list = roleRows.get(role) ?? []
      list.push(row)
      roleRows.set(role, list)
    }
  }

  for (const [key, count] of seen) {
    if (count > 1) {
      const display = rows.find((row) => normalizeInci(row.inci) === key)?.inci ?? key
      issues.push({ severity: 'warn', code: 'duplicate_inci', inci: display, message: `${display} appears ${count} times. Merge into one row unless the split is intentional.` })
    }
  }

  // Skeleton roles.
  const roleStatuses: DraftRoleStatus[] = skeleton.roles.map((item) => {
    const matched = item.role === 'fixative' ? rows.filter((row) => fixativeRows.includes(row.inci)) : roleRows.get(item.role) ?? []
    const percent = Math.round(matched.reduce((sum, row) => sum + row.percent, 0) * 100) / 100
    return {
      role: item.role,
      label: MATERIAL_ROLE_LABELS[item.role],
      requirement: item.requirement,
      status: matched.length > 0 ? 'filled' : 'missing',
      percent,
      rows: matched.map((row) => row.inci),
    }
  })

  for (const item of skeleton.roles) {
    const status = roleStatuses.find((entry) => entry.role === item.role)!
    const label = MATERIAL_ROLE_LABELS[item.role].toLowerCase()

    if (status.status === 'missing') {
      if (item.requirement === 'required') {
        issues.push({ severity: 'block', code: 'role_missing', role: item.role, message: `No ${label}. A ${skeleton.label.toLowerCase()} needs one (${item.budget[0]}–${item.budget[1]}%).${item.note ? ` ${item.note}` : ''}` })
      } else if (item.requirement === 'recommended') {
        issues.push({ severity: 'warn', code: 'role_missing', role: item.role, message: `No ${label}. Usually included (${item.budget[0]}–${item.budget[1]}%).${item.note ? ` ${item.note}` : ''}` })
      }
      continue
    }

    if (item.minRows && status.rows.length < item.minRows) {
      issues.push({
        severity: 'block',
        code: 'role_too_few_rows',
        role: item.role,
        message: `Only ${status.rows.length} ${label} row(s). This format needs at least ${item.minRows} different materials in that role.`,
      })
    }

    if (item.role !== skeleton.balanceRole) {
      if (status.percent < item.budget[0]) {
        // A required role at less than half its band is not doing its job: a 3% "perfume"
        // or a 0.1% preservative is a sketch, not a formula.
        const farBelow = item.requirement === 'required' && status.percent < item.budget[0] / 2
        issues.push({
          severity: farBelow ? 'block' : 'warn',
          code: 'role_below_band',
          role: item.role,
          message: farBelow
            ? `${MATERIAL_ROLE_LABELS[item.role]} total is only ${status.percent}%. This format needs ${item.budget[0]}–${item.budget[1]}% — raise the ${label} rows and lower the ${MATERIAL_ROLE_LABELS[skeleton.balanceRole].toLowerCase()} to keep 100%.`
            : `${MATERIAL_ROLE_LABELS[item.role]} total is ${status.percent}%, below the usual ${item.budget[0]}–${item.budget[1]}%.`,
        })
      } else if (status.percent > item.budget[1]) {
        issues.push({ severity: 'warn', code: 'role_above_band', role: item.role, message: `${MATERIAL_ROLE_LABELS[item.role]} total is ${status.percent}%, above the usual ${item.budget[0]}–${item.budget[1]}%.` })
      }
    }
  }

  // Water logic.
  if (!skeleton.aqueous && hasWater) {
    issues.push({
      severity: 'block',
      code: 'water_in_anhydrous',
      message: `A ${skeleton.label.toLowerCase()} has no water phase. Remove the water, or use the cream / serum format for a water-based product.`,
    })
  }
  if (!skeleton.aqueous && hasPreservative && !hasWater) {
    issues.push({
      severity: 'warn',
      code: 'preservative_not_needed',
      message: 'No water in this formula, so a preservative is not needed. An antioxidant is what protects the oils.',
    })
  }

  // Regulatory rules on the draft, not only after commit.
  if (input.rules?.length) {
    const checks = runRegulatoryChecks({
      rows: rows.map((row) => ({ inci: row.inci, percent: row.percent, phase: row.phase })),
      markets: input.markets,
      productType: input.productType,
      rules: input.rules,
    })
    for (const check of checks) {
      for (const hit of check.hits) {
        if (hit.instrument.startsWith('Seed rules (unknown)')) continue
        const blocking = hit.effect === 'cannot_sell' || hit.effect === 'reduce_percent'
        const action =
          hit.effect === 'cannot_sell'
            ? `Remove ${hit.inci}. `
            : hit.effect === 'reduce_percent' && hit.limit
              ? `Lower ${hit.inci} to at most ${hit.limit}. `
              : ''
        issues.push({
          severity: blocking ? 'block' : 'warn',
          code: 'regulatory',
          inci: hit.inci,
          message: `${check.market}: ${action}${hit.message}`,
        })
      }
    }
  }

  // Claims: the shelf knows the person's own materials; the library knows the rest.
  const claims = input.claims ?? []
  if (claims.length > 0) {
    const claimInventory = rows.map((row) => {
      const material = findMaterial(row.inci)
      const own = findOnShelf(row.inci, inventory, material)
      if (own) return { ...own, inci: row.inci }
      return {
        inci: row.inci,
        stockStatus: 'to_buy' as const,
        animalDerived: material?.animalDerived ?? 'unknown',
        originType: material?.originType ?? 'unknown',
        organicCertified: 'unknown' as const,
      }
    })
    const hits = evaluateClaimHits({ claims, rows, inventory: claimInventory })
    for (const hit of hits) {
      if (hit.severity === 'unknown') continue
      issues.push({
        severity: hit.severity,
        code: 'claim',
        inci: hit.inci,
        message:
          hit.severity === 'block'
            ? `${hit.inci} is animal-derived and the product is vegan. Swap it.`
            : `${hit.inci} is ${hit.reason === 'synthetic' ? 'synthetic' : 'not organic-certified'} and the product claims ${hit.claim}.`,
      })
    }
  }

  const order: Record<DraftIssueSeverity, number> = { block: 0, warn: 1 }
  issues.sort((a, b) => order[a.severity] - order[b.severity])

  return {
    ok: !issues.some((issue) => issue.severity === 'block'),
    format: skeleton.id,
    formatLabel: skeleton.label,
    total,
    rowCount: rows.length,
    issues,
    roles: roleStatuses,
    allergens: [...allergens].sort(),
    toOrder,
  }
}

/** Short plain-text version of the report for the model. */
export function describeDraftReport(report: DraftReport): string {
  const blocks = report.issues.filter((issue) => issue.severity === 'block')
  const warns = report.issues.filter((issue) => issue.severity === 'warn')
  const lines: string[] = []
  lines.push(`${report.formatLabel}: ${report.rowCount} rows, total ${report.total}%.`)
  if (blocks.length) {
    lines.push('Fix before proposing again:')
    for (const issue of blocks) lines.push(`- ${issue.message}`)
  }
  if (warns.length) {
    lines.push(blocks.length ? 'Also worth fixing:' : 'Warnings to mention:')
    for (const issue of warns) lines.push(`- ${issue.message}`)
  }
  const missing = report.roles.filter((role) => role.status === 'missing' && role.requirement !== 'optional')
  if (missing.length) lines.push(`Roles still empty: ${missing.map((role) => role.label).join(', ')}.`)
  if (report.allergens.length) lines.push(`Label allergens: ${report.allergens.join(', ')}.`)
  if (report.toOrder.length) lines.push(`Not on the shelf: ${report.toOrder.map((item) => item.inci).join(', ')}.`)
  return lines.join('\n')
}
