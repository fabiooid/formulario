import { materialEvidenceSummary } from './evidence.ts'
import type { IngredientCategory, ProductClaim } from '../types.ts'
import { normalizeInci } from '../types.ts'
import type { DraftInventoryItem } from './check.ts'
import { MATERIALS, MATERIAL_ROLE_LABELS, findOnShelf, materialKeys, type Material, type MaterialRole } from './materials.ts'
import { getSkeleton, type FormulationFormat, type RoleRequirement } from './skeletons.ts'

/**
 * What the agent reads before it drafts: the skeleton for the chosen format, and for
 * each role a short list of real materials with their use bands. Stock is a flag on
 * each candidate, not a filter — a complete formula wins over what is on the shelf.
 */

export type GuideInventoryItem = DraftInventoryItem & { category?: IngredientCategory; tradeName?: string }

export type GuideCandidate = {
  inci: string
  evidence: ReturnType<typeof materialEvidenceSummary>
  aliases?: string[]
  typical?: [number, number]
  max?: number
  phase?: Material['phase']
  coolDown?: boolean
  allergen?: boolean
  notes?: string
  /** 'not_in_stock' means the person would need to order it. */
  stock: 'in_house' | 'low' | 'to_buy' | 'not_in_stock'
  /** True when this came from the shelf and is not in the library. */
  fromShelf?: boolean
}

export type GuideRole = {
  role: MaterialRole
  label: string
  requirement: RoleRequirement
  budget: [number, number]
  minRows?: number
  note?: string
  candidates: GuideCandidate[]
}

export type FormulationGuide = {
  format: FormulationFormat
  label: string
  summary: string
  aqueous: boolean
  rows: [number, number]
  phases: Array<{ code: string; label: string; instruction: string }>
  process: string[]
  /** Reference split; not a required composition. Validator requirements are listed separately. */
  starter: string[]
  roles: GuideRole[]
  checklist: string[]
}

const CATEGORY_ROLES: Record<IngredientCategory, MaterialRole[]> = {
  solvent: ['solvent', 'humectant'],
  emollient: ['emollient', 'butter'],
  fragrance: ['aroma_material'],
  preservative: ['preservative'],
  antioxidant: ['antioxidant'],
  carrier: ['carrier', 'emollient'],
  active: ['active'],
  other: [],
}

function stockFor(item: GuideInventoryItem | undefined): GuideCandidate['stock'] {
  if (!item) return 'not_in_stock'
  return item.stockStatus
}

function claimScore(material: Pick<Material, 'animalDerived' | 'originType'>, claims: ProductClaim[]) {
  let score = 0
  if (claims.includes('vegan') && material.animalDerived === 'yes') score -= 100
  if (claims.includes('natural')) {
    if (material.originType === 'natural') score += 2
    if (material.originType === 'synthetic') score -= 2
  }
  return score
}

export function buildFormulationGuide(input: {
  format: FormulationFormat
  claims?: ProductClaim[]
  inventory?: GuideInventoryItem[]
  candidatesPerRole?: number
}): FormulationGuide {
  const skeleton = getSkeleton(input.format)
  const claims = input.claims ?? []
  const inventory = input.inventory ?? []
  // Keep the payload lean: every tool result rides along on each later model call.
  // Aroma materials are the exception — a perfume needs a palette, not six picks, and
  // listing them here saves a dozen search calls.
  const limitFor = (role: MaterialRole, requirement: RoleRequirement) => {
    if (input.candidatesPerRole) return input.candidatesPerRole
    if (role === 'aroma_material' && skeleton.productType === 'perfume') return 60
    return requirement === 'required' ? 6 : requirement === 'recommended' ? 4 : 3
  }
  const libraryKeys = new Set(MATERIALS.flatMap(materialKeys))

  const roles: GuideRole[] = skeleton.roles.map((item) => {
    const limit = limitFor(item.role, item.requirement)
    const fromLibrary = MATERIALS.filter((material) => material.roles.includes(item.role))
      .filter((material) => !(claims.includes('vegan') && material.animalDerived === 'yes'))
      .map((material) => {
        const own = findOnShelf(material.inci, inventory, material)
        return { material, own, score: claimScore(material, claims) }
      })
      .sort((a, b) => b.score - a.score)
      .map<GuideCandidate>(({ material, own }) => ({
        inci: material.inci,
        evidence: materialEvidenceSummary(material.inci),
        aliases: material.aliases?.slice(0, 1),
        typical: material.typical,
        max: material.max,
        phase: material.phase,
        coolDown: material.coolDown || undefined,
        allergen: material.allergen || undefined,
        notes: material.notes,
        stock: stockFor(own),
      }))

    const fromShelf = inventory
      .filter((own) => !libraryKeys.has(normalizeInci(own.inci)))
      .filter((own) => own.category && CATEGORY_ROLES[own.category].includes(item.role))
      .filter((own) => !(claims.includes('vegan') && own.animalDerived === 'yes'))
      .map<GuideCandidate>((own) => ({
        inci: own.inci,
        evidence: materialEvidenceSummary(own.inci),
        aliases: own.tradeName ? [own.tradeName] : undefined,
        stock: own.stockStatus,
        fromShelf: true,
        notes: 'On the shelf but not in the library — no use band known. Confirm the amount yourself.',
      }))

    return {
      role: item.role,
      label: MATERIAL_ROLE_LABELS[item.role],
      requirement: item.requirement,
      budget: item.budget,
      minRows: item.minRows,
      note: item.note,
      candidates: [...fromLibrary.slice(0, limit), ...fromShelf],
    }
  })

  const required = skeleton.roles.filter((role) => role.requirement === 'required')
  const checklist = [
    'Choose a formulation strategy for the brief. The starter split is an optional reference; do not copy its composition or add rows merely to match it.',
    `Rows add up to 100%. ${MATERIAL_ROLE_LABELS[skeleton.balanceRole]} is the balance.`,
    `At least ${skeleton.rows[0]} rows (${skeleton.rows[1]} is a reference upper count). This minimum is a current validator constraint, not a measure of formulation quality. Do not pad a formula to pass.`,
    `Current validator requires these roles: ${required.map((role) => MATERIAL_ROLE_LABELS[role.role].toLowerCase()).join(', ')}.`,
    'Every INCI comes from the library or the shelf. Do not invent names. Library membership is not verification. Use get_material_evidence for source-backed properties; unsourced guidance remains unverified.',
    'Typical bands are unverified reference guidance, not safety limits. The validator blocks library ceilings and some role-band violations; disclose unsupported doses.',
    `Phase is one of ${skeleton.phases.map((phase) => phase.code).join(' / ')} as listed here.`,
    ...(skeleton.aqueous
      ? ['This template currently requires preservative, chelator and pH-adjuster roles. This is a validator constraint, not proof that the system is appropriate; assess the specific product.']
      : ['Assess preservation and oxidation for the actual system. Anhydrous templates currently reject water; report conflicts with the intended format rather than silently changing it.']),
    ...(skeleton.productType === 'perfume'
      ? ['List aroma materials one per row — never a single "Fragrance" or "Parfum" row.', 'Only seeded restrictions are checked. IFRA and allergen coverage is incomplete; missing data remains unknown.']
      : []),
    'Respect the product claims (vegan, natural, organic).',
    'Stock is a flag for purchasing only. Never prefer, rank or substitute materials because they are in stock. Choose materials for the brief, then say what needs ordering.',
  ]

  return {
    format: skeleton.id,
    label: skeleton.label,
    summary: skeleton.summary,
    aqueous: skeleton.aqueous,
    rows: skeleton.rows,
    phases: skeleton.phases,
    process: skeleton.process,
    starter: skeleton.starter,
    roles,
    checklist,
  }
}
