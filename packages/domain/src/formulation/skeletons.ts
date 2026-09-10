import type { ProductType } from '../types.ts'
import type { MaterialRole } from './materials.ts'

/**
 * A skeleton is the shape of a finished product: which roles must be filled,
 * how much of the 100% each role usually takes, and the phases a person follows
 * at the bench. The agent fills a skeleton; it does not invent a structure.
 */

export type FormulationFormat =
  | 'face_oil'
  | 'serum'
  | 'cream'
  | 'balm'
  | 'edp'
  | 'oil_perfume'
  | 'solid_perfume'

export const FORMULATION_FORMATS: FormulationFormat[] = [
  'face_oil',
  'serum',
  'cream',
  'balm',
  'edp',
  'oil_perfume',
  'solid_perfume',
]

export type RoleRequirement = 'required' | 'recommended' | 'optional'

export type SkeletonRole = {
  role: MaterialRole
  requirement: RoleRequirement
  /** Combined % w/w for every row that fills this role. */
  budget: [number, number]
  /** Minimum number of distinct rows (a perfume needs many aroma materials, not one). */
  minRows?: number
  note?: string
}

export type SkeletonPhase = {
  code: string
  label: string
  instruction: string
}

export type Skeleton = {
  id: FormulationFormat
  label: string
  productType: ProductType
  summary: string
  /** Water is present, so preservation and pH matter. */
  aqueous: boolean
  /** The role that takes whatever is left to reach 100%. */
  balanceRole: MaterialRole
  /** [minimum rows for a usable draft, typical rows for a finished one] */
  rows: [number, number]
  phases: SkeletonPhase[]
  roles: SkeletonRole[]
  process: string[]
  /**
   * A worked starting split that already adds to 100. The agent copies the shape and
   * swaps materials for the brief; it does not start from a blank page.
   */
  starter: string[]
  /** Words in a brief that point at this format. */
  keywords: string[]
}

export const SKELETONS: Record<FormulationFormat, Skeleton> = {
  cream: {
    id: 'cream',
    label: 'Cream or lotion (oil-in-water emulsion)',
    productType: 'skincare',
    summary:
      'A heated oil-in-water emulsion. Water phase and oil phase both heated to 75 °C, combined, then actives and preservative added below 40 °C.',
    aqueous: true,
    balanceRole: 'water',
    rows: [10, 15],
    phases: [
      { code: 'A', label: 'Water phase', instruction: 'Dissolve chelator, humectants and gum in water. Heat to 75 °C.' },
      { code: 'B', label: 'Oil phase', instruction: 'Melt emulsifiers, fatty alcohols, butters and oils together. Heat to 75 °C.' },
      { code: 'C', label: 'Cool-down', instruction: 'Add B to A under stirring. Below 40 °C add actives, antioxidant, preservative. Adjust pH to 5.0–5.5.' },
    ],
    roles: [
      { role: 'water', requirement: 'required', budget: [50, 80], note: 'Balance to 100%.' },
      { role: 'humectant', requirement: 'required', budget: [2, 10] },
      { role: 'chelator', requirement: 'required', budget: [0.05, 0.3] },
      { role: 'thickener', requirement: 'recommended', budget: [0.1, 1], note: 'A gum stabilises the emulsion over time.' },
      { role: 'emulsifier', requirement: 'required', budget: [2, 8] },
      { role: 'co_emulsifier', requirement: 'recommended', budget: [1, 6], note: 'Fatty alcohol or glyceryl stearate for body and stability.' },
      { role: 'emollient', requirement: 'required', budget: [5, 25], minRows: 2 },
      { role: 'butter', requirement: 'optional', budget: [0, 10] },
      { role: 'active', requirement: 'recommended', budget: [0.1, 10] },
      { role: 'antioxidant', requirement: 'recommended', budget: [0.05, 1] },
      { role: 'preservative', requirement: 'required', budget: [0.3, 1.5] },
      { role: 'preservative_booster', requirement: 'optional', budget: [0, 3] },
      { role: 'ph_adjuster', requirement: 'required', budget: [0.01, 1], note: 'Write the expected amount; adjust at the bench.' },
      { role: 'fragrance_compound', requirement: 'optional', budget: [0, 0.5] },
    ],
    process: [
      'Weigh A and B separately. Heat both to 75 °C and hold 10 minutes.',
      'Pour B into A with steady stirring, then homogenise 1–2 minutes.',
      'Stir while cooling. Below 40 °C add phase C one at a time.',
      'Check pH (target 5.0–5.5) and adjust. Note the final pH.',
    ],
    starter: [
      'A: Aqua 66.6 · Glycerin 4 · Disodium EDTA 0.1 · Xanthan Gum 0.3',
      'B: Glyceryl Stearate Citrate 4 · Cetearyl Alcohol 2 · Squalane 8 · Coco-Caprylate/Caprate 6 · Butyrospermum Parkii Butter 3 · Ceramide NP 0.2',
      'C: Niacinamide 3 · Panthenol 1 · Tocopherol 0.3 · Phenoxyethanol 0.8 · Ethylhexylglycerin 0.4 · Citric Acid 0.3',
      '16 rows, total 100. Swap oils, actives and emulsifier for the brief; keep the shape.',
    ],
    keywords: ['cream', 'lotion', 'moisturiser', 'moisturizer', 'emulsion', 'milk', 'body butter lotion', 'night cream', 'day cream', 'eye cream', 'hand cream'],
  },

  serum: {
    id: 'serum',
    label: 'Water-based serum or gel',
    productType: 'skincare',
    summary:
      'A cold-process water gel. No oil phase to speak of, so the gum carries the texture and the actives do the work.',
    aqueous: true,
    balanceRole: 'water',
    rows: [7, 11],
    phases: [
      { code: 'A', label: 'Water phase', instruction: 'Dissolve chelator and humectants in water. Disperse gum (pre-mixed in glycerin) and let it hydrate.' },
      { code: 'B', label: 'Actives', instruction: 'Add actives one at a time, fully dissolving each.' },
      { code: 'C', label: 'Cool-down', instruction: 'Add preservative and any solubilised oil. Adjust pH.' },
    ],
    roles: [
      { role: 'water', requirement: 'required', budget: [60, 92], note: 'Balance to 100%.' },
      { role: 'humectant', requirement: 'required', budget: [3, 12] },
      { role: 'chelator', requirement: 'required', budget: [0.05, 0.3] },
      { role: 'thickener', requirement: 'recommended', budget: [0.2, 1.5], note: 'Required for a serum or gel; a toner or mist can skip it.' },
      { role: 'active', requirement: 'required', budget: [0.5, 12], minRows: 1 },
      { role: 'preservative', requirement: 'required', budget: [0.3, 1.5] },
      { role: 'preservative_booster', requirement: 'optional', budget: [0, 3] },
      { role: 'ph_adjuster', requirement: 'required', budget: [0.01, 1] },
      { role: 'solubilizer', requirement: 'optional', budget: [0, 3], note: 'Only if an oil-soluble active or fragrance is added.' },
      { role: 'emollient', requirement: 'optional', budget: [0, 3] },
      { role: 'antioxidant', requirement: 'optional', budget: [0, 0.5] },
    ],
    process: [
      'Pre-mix the gum with glycerin, then add to water under stirring.',
      'Dissolve actives one by one; niacinamide and panthenol go in easily, salts last.',
      'Add preservative. Adjust pH to the active’s working range.',
    ],
    starter: [
      'A: Aqua 85.3 · Glycerin 4 · Propanediol 3 · Disodium EDTA 0.1 · Xanthan Gum 0.4',
      'B: Sodium Hyaluronate 0.5 · Niacinamide 4 · Panthenol 1 · Allantoin 0.3',
      'C: Phenoxyethanol 0.8 · Ethylhexylglycerin 0.4 · Citric Acid 0.2',
      '12 rows, total 100. Swap actives for the brief; keep the shape.',
    ],
    keywords: ['serum', 'gel', 'essence', 'toner', 'mist', 'hydrating gel', 'ampoule', 'water-based'],
  },

  face_oil: {
    id: 'face_oil',
    label: 'Anhydrous oil (face or body oil)',
    productType: 'skincare',
    summary:
      'Oils and esters blended cold. No water, so no preservative. The antioxidant is what keeps it from going rancid.',
    aqueous: false,
    balanceRole: 'emollient',
    rows: [3, 6],
    phases: [
      { code: 'A', label: 'Oils', instruction: 'Blend carrier oils and esters at room temperature.' },
      { code: 'B', label: 'Actives and protection', instruction: 'Add oil-soluble actives, antioxidant, and any fragrance. Stir until clear.' },
    ],
    roles: [
      { role: 'emollient', requirement: 'required', budget: [85, 99.9], minRows: 2, note: 'Mix a stable base oil with one or two character oils.' },
      { role: 'antioxidant', requirement: 'required', budget: [0.05, 1] },
      { role: 'active', requirement: 'optional', budget: [0, 10] },
      { role: 'fragrance_compound', requirement: 'optional', budget: [0, 1] },
      { role: 'aroma_material', requirement: 'optional', budget: [0, 1], note: 'Essential oils, if scented.' },
    ],
    process: [
      'Weigh the base oils first, then the fragile oils.',
      'Add antioxidant and actives, stir until uniform.',
      'Fill into dark glass. No heating needed.',
    ],
    starter: [
      'A: Squalane 55 · Coco-Caprylate/Caprate 25 · Simmondsia Chinensis Seed Oil 12 · Rosa Canina Seed Oil 6',
      'B: Bakuchiol 1 · Tocopherol 0.5 · Rosmarinus Officinalis Leaf Extract 0.1 · Isoamyl Laurate 0.4',
      '8 rows, total 100. Swap the character oils and active for the brief; keep one stable base oil above 40%.',
    ],
    keywords: ['face oil', 'body oil', 'facial oil', 'dry oil', 'oil blend', 'beard oil', 'hair oil', 'cleansing oil'],
  },

  balm: {
    id: 'balm',
    label: 'Anhydrous balm or butter',
    productType: 'skincare',
    summary:
      'Wax, butter and oil melted together. Firmness comes from the wax-to-oil ratio. No water, so no preservative.',
    aqueous: false,
    balanceRole: 'emollient',
    rows: [4, 7],
    phases: [
      { code: 'A', label: 'Melt', instruction: 'Melt wax, butter and oils together at 70–75 °C until clear.' },
      { code: 'B', label: 'Cool-down', instruction: 'Below 50 °C add antioxidant, actives and fragrance. Pour while still fluid.' },
    ],
    roles: [
      { role: 'wax', requirement: 'required', budget: [8, 25] },
      { role: 'butter', requirement: 'required', budget: [15, 45] },
      { role: 'emollient', requirement: 'required', budget: [30, 70], minRows: 1, note: 'Balance to 100%.' },
      { role: 'antioxidant', requirement: 'required', budget: [0.05, 1] },
      { role: 'active', requirement: 'optional', budget: [0, 5] },
      { role: 'fragrance_compound', requirement: 'optional', budget: [0, 1] },
      { role: 'aroma_material', requirement: 'optional', budget: [0, 1] },
      { role: 'colorant', requirement: 'optional', budget: [0, 3] },
    ],
    process: [
      'Melt wax first (it has the highest melt point), then butters, then oils.',
      'Cool to about 50 °C before adding antioxidant, actives, fragrance.',
      'Pour into tins and leave undisturbed. Cool fast to avoid grainy shea.',
    ],
    starter: [
      'A: Euphorbia Cerifera Cera 14 · Butyrospermum Parkii Butter 25 · Theobroma Cacao Seed Butter 8 · Simmondsia Chinensis Seed Oil 30 · Caprylic/Capric Triglyceride 21.5',
      'B: Tocopherol 0.5 · Bisabolol 0.5 · Calendula Officinalis Flower Extract 0.5',
      '8 rows, total 100. More wax for a stick, less for a soft salve.',
    ],
    keywords: ['balm', 'salve', 'stick', 'ointment', 'lip balm', 'body butter', 'cleansing balm', 'multi-balm', 'whipped butter'],
  },

  edp: {
    id: 'edp',
    label: 'Alcohol perfume (eau de parfum)',
    productType: 'perfume',
    summary:
      'A concentrate of individual aroma materials at 15–25% of the bottle, dissolved in perfumer’s alcohol. Each material is its own row so allergens and IFRA limits can be checked.',
    aqueous: false,
    balanceRole: 'solvent',
    rows: [10, 18],
    phases: [
      { code: 'A', label: 'Concentrate', instruction: 'Weigh aroma materials one by one into the same beaker. Dissolve crystals in a little alcohol or DPG first.' },
      { code: 'B', label: 'Dilution', instruction: 'Add perfumer’s alcohol. Cap and macerate 2–6 weeks.' },
      { code: 'C', label: 'Finish', instruction: 'Optional water for a softer lift. Chill 24 h, filter, bottle.' },
    ],
    roles: [
      { role: 'aroma_material', requirement: 'required', budget: [12, 25], minRows: 8, note: 'Eau de toilette 8–15%, eau de parfum 15–25%, extrait 25–40%. Spread across top, heart and base.' },
      { role: 'solvent', requirement: 'required', budget: [70, 88], note: 'Alcohol Denat. is the balance to 100%.' },
      { role: 'water', requirement: 'optional', budget: [0, 8] },
      { role: 'fixative', requirement: 'recommended', budget: [0.5, 12], note: 'At least one base fixative (musk, amber, woods) so the scent lasts.' },
      { role: 'antioxidant', requirement: 'optional', budget: [0, 0.2], note: 'Tocopherol protects citrus and linalool.' },
    ],
    process: [
      'Build the concentrate first: base materials, then heart, then top.',
      'Dilute with alcohol to the target concentration. Note the concentrate % on the label of the trial.',
      'Macerate 2–6 weeks in the dark. Chill, filter, then evaluate on skin and paper.',
    ],
    starter: [
      'A top (~3%): Citrus Aurantium Bergamia Fruit Oil 1.5 · Limonene 1 · Linalool 0.5',
      'A heart (~7%): Methyl Dihydrojasmonate 3 · Citrus Aurantium Amara Flower Oil 0.6 · Geraniol 0.6 · Benzyl Salicylate 1.8 · Hexyl Cinnamal 1',
      'A base (~8%): Tetramethyl Acetyloctahydronaphthalenes 3 · Cedrus Atlantica Bark Oil 1.5 · Hexamethylindanopyran 1.5 · Ethylene Brassylate 1.5 · Dodecahydro-3a,6,6,9a-Tetramethylnaphtho(2,1-b)furan 0.5',
      'B: Alcohol Denat. 81.8 · C: Tocopherol 0.2',
      '15 rows, concentrate 18%, total 100. Swap notes for the brief; keep ~3 top, ~5 heart, ~5 base including two fixatives.',
    ],
    keywords: ['eau de parfum', 'edp', 'eau de toilette', 'edt', 'extrait', 'parfum', 'cologne', 'alcohol perfume', 'spray perfume', 'eau de cologne', 'fine fragrance'],
  },

  oil_perfume: {
    id: 'oil_perfume',
    label: 'Oil perfume (roll-on)',
    productType: 'perfume',
    summary:
      'Aroma materials at 10–20% in a neutral carrier oil. Sits closer to the skin than alcohol; needs an antioxidant because the carrier and citrus notes oxidise.',
    aqueous: false,
    balanceRole: 'carrier',
    rows: [8, 14],
    phases: [
      { code: 'A', label: 'Concentrate', instruction: 'Weigh aroma materials together. Warm thick resins slightly before weighing.' },
      { code: 'B', label: 'Carrier', instruction: 'Add carrier oil and antioxidant. Stir until uniform. Macerate 1–4 weeks.' },
    ],
    roles: [
      { role: 'aroma_material', requirement: 'required', budget: [10, 20], minRows: 6, note: 'Individual materials, not one “Fragrance” row.' },
      { role: 'carrier', requirement: 'required', budget: [78, 90], note: 'Caprylic/Capric Triglyceride or jojoba. Balance to 100%.' },
      { role: 'antioxidant', requirement: 'required', budget: [0.05, 0.5] },
      { role: 'fixative', requirement: 'recommended', budget: [0.5, 10] },
      { role: 'solvent', requirement: 'optional', budget: [0, 5], note: 'A little IPM or DPG helps dissolve crystals.' },
    ],
    process: [
      'Build the concentrate in a small beaker, base to top.',
      'Add the carrier oil and tocopherol. Stir well.',
      'Macerate 1–4 weeks in the dark, then fill roll-ons.',
    ],
    starter: [
      'A top (~2%): Citrus Aurantium Bergamia Fruit Oil 1.2 · Elettaria Cardamomum Seed Oil 0.3 · Linalool 0.5',
      'A heart (~5%): Rosa Damascena Flower Oil 0.4 · Pelargonium Graveolens Flower Oil 0.8 · Geraniol 0.6 · Methyl Dihydrojasmonate 2.5 · Citronellol 0.7',
      'A base (~7%): Santalum Album Oil 1.5 · Cedrus Atlantica Bark Oil 2 · Ethylene Brassylate 2.5 · Benzyl Benzoate 1',
      'B: Simmondsia Chinensis Seed Oil 85.8 · Tocopherol 0.2',
      '14 rows, concentrate 14%, total 100. Swap notes for the brief; keep at least 6 aroma materials and one fixative.',
    ],
    keywords: ['oil perfume', 'perfume oil', 'roll-on', 'roll on', 'rollerball', 'attar', 'oil-based', 'oil based', 'anointing oil'],
  },

  solid_perfume: {
    id: 'solid_perfume',
    label: 'Solid perfume',
    productType: 'perfume',
    summary:
      'A wax-and-oil base that holds 8–20% aroma materials. Firmness from the wax; the base should melt on a fingertip.',
    aqueous: false,
    balanceRole: 'carrier',
    rows: [8, 12],
    phases: [
      { code: 'A', label: 'Melt', instruction: 'Melt wax, butter and carrier oil at 70 °C until clear.' },
      { code: 'B', label: 'Cool-down', instruction: 'Below 50 °C add antioxidant and the aroma materials. Pour fast into tins.' },
    ],
    roles: [
      { role: 'wax', requirement: 'required', budget: [15, 30] },
      { role: 'carrier', requirement: 'required', budget: [40, 70], note: 'Balance to 100%.' },
      { role: 'butter', requirement: 'optional', budget: [0, 20] },
      { role: 'aroma_material', requirement: 'required', budget: [8, 20], minRows: 5 },
      { role: 'antioxidant', requirement: 'required', budget: [0.05, 0.5] },
      { role: 'fixative', requirement: 'recommended', budget: [0.5, 6] },
      { role: 'colorant', requirement: 'optional', budget: [0, 2] },
    ],
    process: [
      'Melt the wax and carrier together. Do not overheat once clear.',
      'Cool to about 50 °C, add tocopherol and the concentrate, stir 30 seconds.',
      'Pour into tins. Let set undisturbed. Cure 2–3 days before judging the scent.',
    ],
    starter: [
      'A: Helianthus Annuus Seed Cera 22 · Caprylic/Capric Triglyceride 51.3 · Butyrospermum Parkii Butter 12',
      'B (~14.5%): Vanillin 1 · Vanilla Planifolia Fruit Extract 0.5 · Dipteryx Odorata Seed Extract 0.3 · Ethylene Brassylate 3 · Benzyl Salicylate 2 · Santalum Album Oil 1.5 · Styrax Benzoin Resin Extract 0.7 · Methyl Dihydrojasmonate 2 · Hexamethylindanopyran 1.5 · Citrus Aurantium Dulcis Peel Oil 2',
      'B: Tocopherol 0.2',
      '14 rows, total 100. Swap notes for the brief; keep the wax around 20–25% for a tin.',
    ],
    keywords: ['solid perfume', 'perfume balm', 'solid fragrance', 'scent balm', 'perfume tin'],
  },
}

export function getSkeleton(format: FormulationFormat): Skeleton {
  return SKELETONS[format]
}

export function skeletonsForProductType(type: ProductType): Skeleton[] {
  if (type === 'hybrid') return Object.values(SKELETONS)
  return Object.values(SKELETONS).filter((skeleton) => skeleton.productType === type)
}

export type FormatGuess = {
  format: FormulationFormat
  /** 'brief' when a keyword matched, 'default' when we fell back to the product type. */
  source: 'brief' | 'default'
  matched?: string
}

/**
 * Pick the most likely format from a free-text brief. Longer keywords win so
 * "oil perfume" beats "oil" and "solid perfume" beats "perfume". When nothing
 * matches, fall back to the product type default (cream for skincare, EDP for perfume).
 */
export function inferFormat(input: { brief: string; name?: string; productType: ProductType }): FormatGuess {
  const text = `${input.name ?? ''} ${input.brief}`.toLowerCase()
  const candidates = skeletonsForProductType(input.productType)

  let best: { format: FormulationFormat; keyword: string } | null = null
  for (const skeleton of candidates) {
    for (const keyword of skeleton.keywords) {
      if (!text.includes(keyword)) continue
      if (!best || keyword.length > best.keyword.length) best = { format: skeleton.id, keyword }
    }
  }
  if (best) return { format: best.format, source: 'brief', matched: best.keyword }

  // Perfume-ish words without a named format: alcohol perfume is the common default.
  if (input.productType === 'perfume') return { format: 'edp', source: 'default' }
  if (input.productType === 'hybrid') {
    if (/perfume|fragrance|scent/.test(text)) return { format: 'oil_perfume', source: 'default' }
    if (/\boil\b/.test(text)) return { format: 'face_oil', source: 'default' }
  }
  if (/\boil\b/.test(text) && !/cream|lotion|gel|serum/.test(text)) return { format: 'face_oil', source: 'default' }
  return { format: 'cream', source: 'default' }
}
