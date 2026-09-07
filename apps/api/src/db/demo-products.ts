import { formulaPercentTotal, isPercentBalanced, type Market, type ProductClaim } from '@atelier/domain'

export type SeedFormulaRow = {
  inci: string
  function: string
  phase: string
  percent: number
  tradeName?: string
  notes?: string
  locked?: boolean
}

export type SeedVariant = {
  label: string
  isSelectedFinal?: boolean
  rows: SeedFormulaRow[]
}

export type SeedOlfactoryPyramid = {
  direction: string
  top: string[]
  heart: string[]
  base: string[]
}

export type SeedProduct = {
  id: string
  name: string
  type: 'skincare' | 'perfume' | 'hybrid'
  markets: Market[]
  brief: string
  claims?: ProductClaim[]
  pinned?: boolean
  olfactoryPyramid?: SeedOlfactoryPyramid
  variants: SeedVariant[]
}

/** Retired toy products from older seeds — removed on each re-seed. */
export const RETIRED_DEMO_PRODUCT_IDS = ['prod-cream', 'prod-perfume'] as const

function fromParts(entries: Array<Omit<SeedFormulaRow, 'percent'> & { parts: number }>): SeedFormulaRow[] {
  const totalParts = entries.reduce((sum, entry) => sum + entry.parts, 0)
  const rows = entries.map(({ parts, ...row }) => ({
    ...row,
    percent: Math.round((parts / totalParts) * 10000) / 100,
  }))
  return balanceRows(rows)
}

function balanceRows(rows: SeedFormulaRow[]): SeedFormulaRow[] {
  const total = formulaPercentTotal(rows)
  const drift = Math.round((100 - total) * 100) / 100
  if (drift === 0) return rows
  return rows.map((row, index) =>
    index === 0 ? { ...row, percent: Math.round((row.percent + drift) * 100) / 100 } : row,
  )
}

const superskinConstituentNotes = [
  'Locked fragrance concentrate (32% of the finished oil).',
  'Major declared constituents are listed as their own rows for allergen and UV-filter awareness.',
  'Citrus aurantium bergamia peel oil ~4.554%; Trimethylcyclopentenyl Methylisopentenol ~2.814%;',
  'Limonene ~1.856%; Geraniol ~1.388%; Citronellol ~1.382%; Linalyl acetate ~1.136%;',
  'Geranyl acetate ~0.854%; Linalool ~0.587%; Pinene ~0.347%;',
  'Butyl methoxydibenzoylmethane 0.3%; Ethylhexyl methoxycinnamate 0.3%; BHT 0.2%;',
  'Juniperus virginiana wood oil 0.2%; plus trace allergens inside this concentrate.',
].join(' ')

export const DEMO_PRODUCTS: SeedProduct[] = [
  {
    id: 'prod-face-oil',
    name: 'Dry Unscented Face Oil',
    type: 'skincare',
    markets: ['EU', 'ASEAN'],
    brief: 'Light unscented face oil that feels dry on skin. No essential oils. EU home market.',
    claims: ['vegan', 'natural'],
    variants: [
      {
        label: 'Main',
        rows: [
          { inci: 'Squalane', function: 'Emollient', phase: 'Oil', percent: 70 },
          { inci: 'Caprylic/Capric Triglyceride', function: 'Emollient', phase: 'Oil', percent: 25 },
          { inci: 'MadeUpine', function: 'Active', phase: 'Oil', percent: 5, notes: 'Unknown INCI for demo' },
        ],
      },
    ],
  },
  {
    id: 'prod-superskin',
    name: 'SUPERSKIN',
    type: 'perfume',
    markets: ['EU'],
    brief: 'Oil perfume, warm woody-amber skin scent.',
    claims: ['vegan'],
    pinned: true,
    olfactoryPyramid: {
      direction: 'Warm woody-amber skin scent',
      top: ['Bergamot'],
      heart: ['Gardenia', 'Rose'],
      base: ['Amber', 'Musk', 'Woody', 'Amyris'],
    },
    variants: [
      {
        label: 'Finished oil',
        isSelectedFinal: true,
        rows: [
          { inci: 'Triethyl Citrate', function: 'Solvent', phase: 'Oil', percent: 68 },
          {
            inci: 'Parfum',
            function: 'Fragrance',
            phase: 'Fragrance',
            percent: 16.082,
            locked: true,
            notes: superskinConstituentNotes,
          },
          {
            inci: 'Citrus Aurantium Bergamia Peel Oil',
            function: 'Fragrance',
            phase: 'Fragrance',
            percent: 4.554,
            notes: 'Declared constituent of the 32% concentrate',
          },
          {
            inci: 'Trimethylcyclopentenyl Methylisopentenol',
            function: 'Fragrance',
            phase: 'Fragrance',
            percent: 2.814,
            notes: 'Declared constituent of the 32% concentrate',
          },
          {
            inci: 'Limonene',
            function: 'Fragrance allergen',
            phase: 'Fragrance',
            percent: 1.856,
            notes: 'Declared constituent of the 32% concentrate',
          },
          {
            inci: 'Geraniol',
            function: 'Fragrance allergen',
            phase: 'Fragrance',
            percent: 1.388,
            notes: 'Declared constituent of the 32% concentrate',
          },
          {
            inci: 'Citronellol',
            function: 'Fragrance allergen',
            phase: 'Fragrance',
            percent: 1.382,
            notes: 'Declared constituent of the 32% concentrate',
          },
          {
            inci: 'Linalyl Acetate',
            function: 'Fragrance',
            phase: 'Fragrance',
            percent: 1.136,
            notes: 'Declared constituent of the 32% concentrate',
          },
          {
            inci: 'Geranyl Acetate',
            function: 'Fragrance',
            phase: 'Fragrance',
            percent: 0.854,
            notes: 'Declared constituent of the 32% concentrate',
          },
          {
            inci: 'Linalool',
            function: 'Fragrance allergen',
            phase: 'Fragrance',
            percent: 0.587,
            notes: 'Declared constituent of the 32% concentrate',
          },
          {
            inci: 'Pinene',
            function: 'Fragrance',
            phase: 'Fragrance',
            percent: 0.347,
            notes: 'Declared constituent of the 32% concentrate',
          },
          {
            inci: 'Butyl Methoxydibenzoylmethane',
            function: 'UV filter',
            phase: 'Oil',
            percent: 0.3,
            notes: 'Declared constituent of the 32% concentrate',
          },
          {
            inci: 'Ethylhexyl Methoxycinnamate',
            function: 'UV filter',
            phase: 'Oil',
            percent: 0.3,
            notes: 'Declared constituent of the 32% concentrate',
          },
          {
            inci: 'BHT',
            function: 'Antioxidant',
            phase: 'Oil',
            percent: 0.2,
            notes: 'Declared constituent of the 32% concentrate',
          },
          {
            inci: 'Juniperus Virginiana Wood Oil',
            function: 'Fragrance',
            phase: 'Fragrance',
            percent: 0.2,
            notes: 'Declared constituent of the 32% concentrate',
          },
        ],
      },
      {
        label: 'Concentrate',
        rows: fromParts([
          {
            inci: 'Dodecahydro Tetramethyl Naphthofuran',
            tradeName: 'Ambrox Super 10%',
            function: 'Fragrance',
            phase: 'Fragrance',
            parts: 30,
            notes: 'Concentrate parts, 10% dilution. Not finished-oil %.',
          },
          {
            inci: 'Oxacyclohexadecen-2-one',
            tradeName: 'Ambrettolide',
            function: 'Fragrance',
            phase: 'Fragrance',
            parts: 25,
            notes: 'Concentrate parts. Not finished-oil %.',
          },
          {
            inci: '3-Methylcyclopentadecanone',
            tradeName: 'Muscone',
            function: 'Fragrance',
            phase: 'Fragrance',
            parts: 25,
            notes: 'Concentrate parts. Not finished-oil %.',
          },
          {
            inci: 'Pentadecalactone',
            tradeName: 'Exaltolide 50%',
            function: 'Fragrance',
            phase: 'Fragrance',
            parts: 8,
            notes: 'Concentrate parts, 50% dilution. Not finished-oil %.',
          },
          {
            inci: '3-Methyl-4-octanolide',
            tradeName: 'Whiskey Lactone',
            function: 'Fragrance',
            phase: 'Fragrance',
            parts: 6,
            notes: 'Concentrate parts. Not finished-oil %.',
          },
          {
            inci: 'Amyris Balsamifera Bark Oil',
            tradeName: 'Amyris Oil',
            function: 'Fragrance',
            phase: 'Fragrance',
            parts: 6,
            notes: 'Concentrate parts. Not finished-oil %.',
          },
          {
            inci: 'Ambrocenide',
            tradeName: 'Ambrocenide 10%',
            function: 'Fragrance',
            phase: 'Fragrance',
            parts: 5,
            notes: 'Concentrate parts, 10% dilution. Not finished-oil %.',
          },
          {
            inci: 'Ebanol',
            tradeName: 'Ebanol',
            function: 'Fragrance',
            phase: 'Fragrance',
            parts: 4,
            notes: 'Concentrate parts. Not finished-oil %.',
          },
          {
            inci: 'Gardenia Florida Extract',
            tradeName: 'Gardenia HS',
            function: 'Fragrance',
            phase: 'Fragrance',
            parts: 1.5,
            notes: 'Concentrate parts. Not finished-oil %.',
          },
          {
            inci: 'Rosa Damascena Flower Oil',
            tradeName: 'Rosessence',
            function: 'Fragrance',
            phase: 'Fragrance',
            parts: 1,
            notes: 'Concentrate parts. Not finished-oil %.',
          },
          {
            inci: 'Citrus Aurantium Bergamia Peel Oil',
            tradeName: 'Bergamot Givco',
            function: 'Fragrance',
            phase: 'Fragrance',
            parts: 2,
            notes: 'Concentrate parts. Not finished-oil %.',
          },
          {
            inci: 'Citrus Aurantium Bergamia Peel Oil',
            tradeName: 'Bergamot FCF',
            function: 'Fragrance',
            phase: 'Fragrance',
            parts: 2,
            notes: 'Concentrate parts. Not finished-oil %.',
          },
          {
            inci: 'Norlimbanol',
            tradeName: 'Norlimbanol',
            function: 'Fragrance',
            phase: 'Fragrance',
            parts: 2,
            notes: 'Concentrate parts. Not finished-oil %.',
          },
        ]),
      },
    ],
  },
  {
    id: 'prod-gel-doccia-vetiver',
    name: 'Gel Doccia Vetiver',
    type: 'skincare',
    markets: ['EU'],
    brief: 'Body shower gel, vetiver direction.',
    pinned: true,
    variants: [
      {
        label: 'Main',
        isSelectedFinal: true,
        rows: [
          { inci: 'Aqua', function: 'Solvent', phase: 'Water', percent: 73 },
          {
            inci: 'Potassium Cocoyl Rice Amino Acids, Disodium Cocoyl Glutamate',
            tradeName: 'LIPOSINEGLYGLUR',
            function: 'Surfactant',
            phase: 'Water',
            percent: 10,
            notes: 'Blend: Aqua / Potassium cocoyl rice amino acids / Disodium cocoyl glutamate',
          },
          {
            inci: 'Cocamidopropyl Betaine',
            tradeName: 'COCCOBETAINA',
            function: 'Surfactant',
            phase: 'Water',
            percent: 7,
            notes: 'Blend: Aqua / Cocamidopropyl betaine / Sodium benzoate',
          },
          {
            inci: 'Disodium Laureth Sulfosuccinate',
            function: 'Surfactant',
            phase: 'Water',
            percent: 5,
          },
          {
            inci: 'Parfum',
            tradeName: 'PETITGRAIN 1 ... 2.2044 BIS',
            function: 'Fragrance',
            phase: 'Fragrance',
            percent: 2,
            notes: 'Fragrance concentrate, petitgrain / vetiver direction',
          },
          { inci: 'Citric Acid', function: 'pH adjuster', phase: 'Water', percent: 1 },
          {
            inci: 'Phenoxyethanol, Ethylhexylglycerin',
            tradeName: 'SHAROMIX EG-14',
            function: 'Preservative',
            phase: 'Water',
            percent: 1,
            notes: 'Blend: Phenoxyethanol / Ethylhexylglycerin',
          },
          { inci: 'Sodium Chloride', function: 'Viscosity modifier', phase: 'Water', percent: 1 },
        ],
      },
    ],
  },
  {
    id: 'prod-crema-mani-cedro',
    name: 'Crema Mani Cedro',
    type: 'skincare',
    markets: ['EU'],
    brief: 'Cedar hand cream, leave-on.',
    pinned: true,
    variants: [
      {
        label: 'Main',
        isSelectedFinal: true,
        rows: balanceRows([
          { inci: 'Aqua', function: 'Solvent', phase: 'Water', percent: 53.9879 },
          { inci: 'Prunus Amygdalus Dulcis Oil', function: 'Emollient', phase: 'Oil', percent: 7.1984 },
          { inci: 'Glycerin', function: 'Humectant', phase: 'Water', percent: 7.1264 },
          { inci: 'Polysorbate 60', function: 'Emulsifier', phase: 'Oil', percent: 3.5992 },
          { inci: 'Cetearyl Alcohol', function: 'Emulsifier', phase: 'Oil', percent: 3.592 },
          { inci: 'Ethylhexyl Palmitate', function: 'Emollient', phase: 'Oil', percent: 3.5632 },
          { inci: 'Sorbitan Stearate', function: 'Emulsifier', phase: 'Oil', percent: 3.5272 },
          {
            inci: 'Parfum',
            tradeName: 'CEDRO concentrate',
            function: 'Fragrance',
            phase: 'Fragrance',
            percent: 3.52,
            notes: 'Cedar fragrance concentrate',
          },
          { inci: 'Stearic Acid', function: 'Emulsifier', phase: 'Oil', percent: 3.4552 },
          { inci: 'Phenoxyethanol', function: 'Preservative', phase: 'Water', percent: 0.7198 },
          { inci: 'Aloe Barbadensis Leaf Juice', function: 'Active', phase: 'Water', percent: 0.7126 },
          {
            inci: 'Hydrolyzed Theobroma Cacao Seed Butter',
            function: 'Emollient',
            phase: 'Oil',
            percent: 0.7054,
          },
          { inci: 'Butyrospermum Parkii Butter', function: 'Emollient', phase: 'Oil', percent: 0.6982 },
          { inci: 'Sodium Hydroxide', function: 'pH adjuster', phase: 'Water', percent: 0.691 },
          { inci: 'Olea Europaea Fruit Oil', function: 'Emollient', phase: 'Oil', percent: 0.6838 },
          { inci: 'Persea Gratissima Oil', function: 'Emollient', phase: 'Oil', percent: 0.6766 },
          { inci: 'Macadamia Ternifolia Seed Oil', function: 'Emollient', phase: 'Oil', percent: 0.6695 },
          { inci: 'Simmondsia Chinensis Seed Oil', function: 'Emollient', phase: 'Oil', percent: 0.6623 },
          { inci: 'Propylene Glycol', function: 'Humectant', phase: 'Water', percent: 0.6551 },
          { inci: 'Sodium Hyaluronate', function: 'Humectant', phase: 'Water', percent: 0.6479 },
          { inci: 'Allantoin', function: 'Active', phase: 'Water', percent: 0.6407 },
          { inci: 'Ethylhexylglycerin', function: 'Preservative', phase: 'Water', percent: 0.6335 },
          { inci: 'Carbomer', function: 'Thickener', phase: 'Water', percent: 0.6263 },
          { inci: 'Ascorbyl Palmitate', function: 'Antioxidant', phase: 'Oil', percent: 0.072 },
          { inci: 'Benzyl Alcohol', function: 'Preservative', phase: 'Water', percent: 0.072 },
          { inci: 'Calendula Officinalis Flower Extract', function: 'Active', phase: 'Water', percent: 0.072 },
          { inci: 'Citric Acid', function: 'pH adjuster', phase: 'Water', percent: 0.072 },
          {
            inci: 'Hydroxyethyl Acrylate/Sodium Acryloyldimethyl Taurate Copolymer',
            function: 'Thickener',
            phase: 'Water',
            percent: 0.072,
          },
          { inci: 'Isohexadecane', function: 'Emollient', phase: 'Oil', percent: 0.072 },
          { inci: 'Lecithin', function: 'Emulsifier', phase: 'Oil', percent: 0.072 },
          { inci: 'Malva Sylvestris Leaf Extract', function: 'Active', phase: 'Water', percent: 0.072 },
          { inci: 'Panthenol', function: 'Active', phase: 'Water', percent: 0.072 },
          { inci: 'Ruscus Aculeatus Root Extract', function: 'Active', phase: 'Water', percent: 0.072 },
          { inci: 'Sorbitan Isostearate', function: 'Emulsifier', phase: 'Oil', percent: 0.072 },
          { inci: 'Tetrasodium Glutamate Diacetate', function: 'Chelating agent', phase: 'Water', percent: 0.072 },
          { inci: 'Tocopherol', function: 'Antioxidant', phase: 'Oil', percent: 0.072 },
          { inci: 'Tocopheryl Acetate', function: 'Antioxidant', phase: 'Oil', percent: 0.072 },
        ]),
      },
    ],
  },
]

export function assertDemoFormulasBalanced() {
  for (const product of DEMO_PRODUCTS) {
    for (const variant of product.variants) {
      if (!isPercentBalanced(variant.rows)) {
        throw new Error(
          `Seed formula ${product.name} / ${variant.label} totals ${formulaPercentTotal(variant.rows)}%`,
        )
      }
    }
  }
}
