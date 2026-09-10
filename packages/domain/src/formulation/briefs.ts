import type { ProductClaim, ProductType } from '../types.ts'
import type { FormulationFormat } from './skeletons.ts'

/**
 * A fixed set of briefs we score the agent against. Same briefs every time, so a
 * change to the prompt, the library or the model can be compared, not eyeballed.
 * Used by the unit tests (format inference) and by the live eval script in apps/api.
 */
export type EvalBrief = {
  id: string
  name: string
  type: ProductType
  brief: string
  claims?: ProductClaim[]
  expectFormat: FormulationFormat
  /** Materials that should be in a good answer (INCI or alias). Optional hints for the score. */
  expectMaterials?: string[]
}

export const EVAL_BRIEFS: EvalBrief[] = [
  {
    id: 'barrier-cream',
    name: 'Daily Barrier Cream',
    type: 'skincare',
    brief: 'A fragrance-free ceramide cream for compromised barriers. Under €40/kg, EU market, vegan. Simple emulsifier system for a 5 kg bench batch.',
    claims: ['vegan'],
    expectFormat: 'cream',
    expectMaterials: ['Ceramide NP', 'Glycerin', 'Phenoxyethanol'],
  },
  {
    id: 'light-lotion',
    name: 'Morning Lotion',
    type: 'skincare',
    brief: 'Light daily lotion for combination skin. Fast-absorbing, non-greasy, natural claim, subtle no-fragrance feel.',
    claims: ['natural'],
    expectFormat: 'cream',
  },
  {
    id: 'ha-serum',
    name: 'Hydration Serum',
    type: 'skincare',
    brief: 'A hyaluronic acid serum with niacinamide for dehydrated skin. Clear gel, pH around 5.5.',
    expectFormat: 'serum',
    expectMaterials: ['Sodium Hyaluronate', 'Niacinamide'],
  },
  {
    id: 'soothing-gel',
    name: 'After-Sun Gel',
    type: 'skincare',
    brief: 'Cooling aloe gel with panthenol and allantoin for after sun. Light, quick to dry, vegan.',
    claims: ['vegan'],
    expectFormat: 'serum',
    expectMaterials: ['Aloe Barbadensis Leaf Juice', 'Panthenol'],
  },
  {
    id: 'dry-face-oil',
    name: 'Dry Unscented Face Oil',
    type: 'skincare',
    brief: 'Light unscented face oil that feels dry on skin. No essential oils. EU home market.',
    claims: ['vegan', 'natural'],
    expectFormat: 'face_oil',
    expectMaterials: ['Squalane', 'Tocopherol'],
  },
  {
    id: 'night-oil',
    name: 'Night Repair Oil',
    type: 'skincare',
    brief: 'A richer night facial oil with rosehip and bakuchiol. Organic where possible.',
    claims: ['organic'],
    expectFormat: 'face_oil',
    expectMaterials: ['Rosa Canina Seed Oil', 'Bakuchiol', 'Tocopherol'],
  },
  {
    id: 'lip-balm',
    name: 'Plain Lip Balm',
    type: 'skincare',
    brief: 'A firm unscented lip balm in a stick. Vegan, so no beeswax.',
    claims: ['vegan'],
    expectFormat: 'balm',
    expectMaterials: ['Euphorbia Cerifera Cera', 'Butyrospermum Parkii Butter'],
  },
  {
    id: 'hand-salve',
    name: 'Gardener’s Salve',
    type: 'skincare',
    brief: 'Thick hand salve for cracked skin with shea and calendula. Beeswax is fine.',
    expectFormat: 'balm',
    expectMaterials: ['Cera Alba', 'Calendula Officinalis Flower Extract'],
  },
  {
    id: 'citrus-edp',
    name: 'Bergamot No. 1',
    type: 'perfume',
    brief: 'A bright citrus eau de parfum: bergamot and neroli over a soft musk and cedar base. Around 18% concentrate.',
    expectFormat: 'edp',
    expectMaterials: ['Alcohol Denat.', 'Citrus Aurantium Bergamia Fruit Oil'],
  },
  {
    id: 'woody-edp',
    name: 'Cedar Room',
    type: 'perfume',
    brief: 'Dry woody amber spray perfume. Iso E Super, ambroxan, vetiver, a touch of iris. Long-lasting.',
    expectFormat: 'edp',
    expectMaterials: ['Tetramethyl Acetyloctahydronaphthalenes', 'Vetiveria Zizanoides Root Oil'],
  },
  {
    id: 'rose-oil-perfume',
    name: 'Rose Roll-On',
    type: 'perfume',
    brief: 'A rose and sandalwood perfume oil roll-on for sensitive skin. Jojoba base.',
    expectFormat: 'oil_perfume',
    expectMaterials: ['Simmondsia Chinensis Seed Oil', 'Tocopherol'],
  },
  {
    id: 'seed-oil-perfume',
    name: 'No. 3 Oil Perfume',
    type: 'perfume',
    brief: 'Oil-based EDP-style perfume. IFRA + EU allergen labelling.',
    expectFormat: 'oil_perfume',
  },
  {
    id: 'solid-perfume',
    name: 'Pocket Vanilla',
    type: 'perfume',
    brief: 'A warm vanilla and tonka solid perfume in a small tin. Vegan wax.',
    claims: ['vegan'],
    expectFormat: 'solid_perfume',
    expectMaterials: ['Vanillin', 'Helianthus Annuus Seed Cera'],
  },
  {
    id: 'hybrid-scented-oil',
    name: 'Scented Body Oil',
    type: 'hybrid',
    brief: 'A lightly scented body oil with lavender. Doubles as a light perfume oil.',
    expectFormat: 'oil_perfume',
  },
]
