import { describe, expect, it } from 'vitest'
import { SEED_RULES } from '../rules/seed-rules.ts'
import { normalizeInci } from '../types.ts'
import { EVAL_BRIEFS } from './briefs.ts'
import { checkFormulaDraft, describeDraftReport, type DraftRow } from './check.ts'
import { buildFormulationGuide } from './guide.ts'
import { MATERIALS, findMaterial, searchMaterials } from './materials.ts'
import { FORMULATION_FORMATS, SKELETONS, inferFormat } from './skeletons.ts'

const row = (inci: string, fn: string, phase: string, percent: number): DraftRow => ({
  inci,
  function: fn,
  phase,
  percent,
})

const goodCream: DraftRow[] = [
  row('Aqua', 'Solvent', 'A', 66.6),
  row('Glycerin', 'Humectant', 'A', 4),
  row('Disodium EDTA', 'Chelator', 'A', 0.1),
  row('Xanthan Gum', 'Thickener', 'A', 0.3),
  row('Glyceryl Stearate Citrate', 'Emulsifier', 'B', 4),
  row('Cetearyl Alcohol', 'Co-emulsifier', 'B', 2),
  row('Squalane', 'Emollient', 'B', 8),
  row('Coco-Caprylate/Caprate', 'Emollient', 'B', 6),
  row('Butyrospermum Parkii Butter', 'Butter', 'B', 3),
  row('Ceramide NP', 'Active', 'B', 0.2),
  row('Panthenol', 'Active', 'C', 1),
  row('Tocopherol', 'Antioxidant', 'C', 0.3),
  row('Phenoxyethanol', 'Preservative', 'C', 0.8),
  row('Ethylhexylglycerin', 'Preservative booster', 'C', 0.4),
  row('Niacinamide', 'Active', 'C', 3),
  row('Citric Acid', 'pH adjuster', 'C', 0.3),
]

const goodOilPerfume: DraftRow[] = [
  row('Rosa Damascena Flower Oil', 'Heart note', 'A', 0.4),
  row('Pelargonium Graveolens Flower Oil', 'Heart note', 'A', 0.8),
  row('Geraniol', 'Heart note', 'A', 0.6),
  row('Citronellol', 'Heart note', 'A', 0.8),
  row('Santalum Album Oil', 'Base note', 'A', 1.5),
  row('Cedrus Atlantica Bark Oil', 'Base note', 'A', 2),
  row('Ethylene Brassylate', 'Fixative', 'A', 2.5),
  row('Methyl Dihydrojasmonate', 'Heart note', 'A', 3),
  row('Citrus Aurantium Bergamia Fruit Oil', 'Top note', 'A', 1.4),
  row('Simmondsia Chinensis Seed Oil', 'Carrier', 'B', 86.8),
  row('Tocopherol', 'Antioxidant', 'B', 0.2),
]

describe('materials library', () => {
  it('has sane bands and no duplicate names', () => {
    const seen = new Set<string>()
    for (const material of MATERIALS) {
      const [low, high] = material.typical
      expect(low, material.inci).toBeGreaterThanOrEqual(0)
      expect(high, material.inci).toBeGreaterThanOrEqual(low)
      expect(high, material.inci).toBeLessThanOrEqual(100)
      if (material.max != null) expect(material.max, material.inci).toBeGreaterThanOrEqual(high)
      const key = normalizeInci(material.inci)
      expect(seen.has(key), `duplicate ${material.inci}`).toBe(false)
      seen.add(key)
    }
  })

  it('finds a material by INCI or by a trade name', () => {
    expect(findMaterial('squalane')?.inci).toBe('Squalane')
    expect(findMaterial('Shea Butter')?.inci).toBe('Butyrospermum Parkii Butter')
    expect(findMaterial('Iso E Super')?.roles).toContain('aroma_material')
    expect(findMaterial('MadeUpine')).toBeUndefined()
  })

  it('searches by role and by word', () => {
    expect(searchMaterials('', { role: 'chelator' }).map((m) => m.inci)).toContain('Disodium EDTA')
    expect(searchMaterials('musk').map((m) => m.inci)).toContain('Ethylene Brassylate')
  })

  it('every required role in every skeleton has at least two library candidates', () => {
    for (const format of FORMULATION_FORMATS) {
      for (const role of SKELETONS[format].roles) {
        if (role.requirement !== 'required') continue
        const count = MATERIALS.filter((m) => m.roles.includes(role.role)).length
        expect(count, `${format} / ${role.role}`).toBeGreaterThanOrEqual(2)
      }
    }
  })
})

/** Turn "A: Aqua 66.6 · Glycerin 4" lines into rows so the starters can be checked like any draft. */
function rowsFromStarter(lines: string[]): DraftRow[] {
  const rows: DraftRow[] = []
  for (const line of lines) {
    if (!line.includes('·') && !/\d$/.test(line.trim())) continue
    let phase = 'A'
    for (const part of line.split(' · ')) {
      let text = part.trim()
      const labelled = text.match(/^([A-C])\b[^:]*:\s*(.*)$/)
      if (labelled) {
        phase = labelled[1]
        text = labelled[2]
      }
      const match = text.match(/^(.*\S)\s+(\d+(?:\.\d+)?)$/)
      if (!match) continue
      rows.push({ inci: match[1], function: '', phase, percent: Number(match[2]) })
    }
  }
  return rows
}

describe('starter splits', () => {
  it('every starter passes its own skeleton check', () => {
    for (const format of FORMULATION_FORMATS) {
      const skeleton = SKELETONS[format]
      const rows = rowsFromStarter(skeleton.starter)
      const report = checkFormulaDraft({ rows, format, productType: skeleton.productType, markets: ['EU'], rules: SEED_RULES, claims: ['vegan'] })
      const blocks = report.issues.filter((i) => i.severity === 'block').map((i) => i.message)
      expect(blocks, `${format}: ${blocks.join(' | ')}`).toEqual([])
      expect(rows.length, format).toBeGreaterThanOrEqual(skeleton.rows[0])
      for (const r of rows) expect(findMaterial(r.inci), `${format}: ${r.inci}`).toBeDefined()
    }
  })
})

describe('inferFormat', () => {
  it('picks the expected format for every eval brief', () => {
    for (const brief of EVAL_BRIEFS) {
      const guess = inferFormat({ brief: brief.brief, name: brief.name, productType: brief.type })
      expect(guess.format, brief.id).toBe(brief.expectFormat)
    }
  })

  it('falls back to the product type default', () => {
    expect(inferFormat({ brief: 'Something nice', productType: 'skincare' })).toEqual({ format: 'cream', source: 'default' })
    expect(inferFormat({ brief: 'Something nice', productType: 'perfume' })).toEqual({ format: 'edp', source: 'default' })
  })

  it('does not mistake a cream with shea butter for a balm', () => {
    expect(inferFormat({ brief: 'Rich night cream with shea butter', productType: 'skincare' }).format).toBe('cream')
  })
})

describe('checkFormulaDraft', () => {
  const base = { productType: 'skincare' as const, markets: ['EU' as const], rules: SEED_RULES }

  it('passes a complete cream', () => {
    const report = checkFormulaDraft({ ...base, format: 'cream', rows: goodCream })
    expect(report.issues.filter((i) => i.severity === 'block')).toEqual([])
    expect(report.ok).toBe(true)
    expect(report.roles.find((r) => r.role === 'preservative')?.status).toBe('filled')
    expect(report.roles.find((r) => r.role === 'emollient')?.rows).toHaveLength(2)
  })

  it('rejects the short cream the agent used to write', () => {
    const report = checkFormulaDraft({
      ...base,
      format: 'cream',
      rows: [
        row('Aqua', 'Solvent', 'Water', 68.5),
        row('Glycerin', 'Humectant', 'Water', 5),
        row('Cetearyl Alcohol', 'Emulsifier', 'Water', 4),
        row('Shea Butter', 'Emollient', 'Oil', 10),
        row('Squalane', 'Emollient', 'Oil', 10),
        row('Phenoxyethanol', 'Preservative', 'Water', 1.5),
        row('Tocopherol', 'Antioxidant', 'Oil', 1),
      ],
    })
    expect(report.ok).toBe(false)
    const codes = report.issues.filter((i) => i.severity === 'block').map((i) => i.code)
    expect(codes).toContain('too_few_rows')
    expect(codes).toContain('role_missing') // chelator, emulsifier, pH
    expect(codes).toContain('above_max') // phenoxyethanol 1.5
    expect(codes).toContain('regulatory') // EU annex V
    const missing = report.roles.filter((r) => r.status === 'missing' && r.requirement === 'required').map((r) => r.role)
    expect(missing).toEqual(expect.arrayContaining(['chelator', 'emulsifier', 'ph_adjuster']))
  })

  it('blocks invented INCI names', () => {
    const rows = goodCream.map((r) => (r.inci === 'Ceramide NP' ? { ...r, inci: 'MadeUpine' } : r))
    const report = checkFormulaDraft({ ...base, format: 'cream', rows })
    expect(report.issues.some((i) => i.code === 'unknown_material' && i.severity === 'block')).toBe(true)
  })

  it('accepts a material that is only on the shelf', () => {
    const rows = goodCream.map((r) => (r.inci === 'Ceramide NP' ? { ...r, inci: 'MadeUpine' } : r))
    const report = checkFormulaDraft({
      ...base,
      format: 'cream',
      rows,
      inventory: [{ inci: 'MadeUpine', stockStatus: 'in_house', animalDerived: 'no', originType: 'unknown', organicCertified: 'unknown' }],
    })
    expect(report.issues.some((i) => i.code === 'unknown_material')).toBe(false)
  })

  it('blocks when the total is off', () => {
    const rows = goodCream.map((r) => (r.inci === 'Aqua' ? { ...r, percent: 60 } : r))
    const report = checkFormulaDraft({ ...base, format: 'cream', rows })
    expect(report.issues.some((i) => i.code === 'total_not_100')).toBe(true)
  })

  it('needs a preservative, chelator and pH adjuster when water is present', () => {
    const rows = goodCream.filter((r) => !['Phenoxyethanol', 'Disodium EDTA', 'Citric Acid'].includes(r.inci))
    rows[0] = { ...rows[0], percent: rows[0].percent + 0.8 + 0.1 + 0.3 }
    const report = checkFormulaDraft({ ...base, format: 'cream', rows })
    const missing = report.issues.filter((i) => i.code === 'role_missing' && i.severity === 'block').map((i) => i.role)
    expect(missing).toEqual(expect.arrayContaining(['preservative', 'chelator', 'ph_adjuster']))
  })

  it('passes a face oil and warns about a pointless preservative', () => {
    const report = checkFormulaDraft({
      ...base,
      format: 'face_oil',
      rows: [
        row('Squalane', 'Emollient', 'A', 60),
        row('Coco-Caprylate/Caprate', 'Emollient', 'A', 30),
        row('Rosa Canina Seed Oil', 'Emollient', 'A', 8.7),
        row('Tocopherol', 'Antioxidant', 'B', 0.5),
        row('Phenoxyethanol', 'Preservative', 'B', 0.8),
      ],
    })
    expect(report.ok).toBe(true)
    expect(report.issues.some((i) => i.code === 'preservative_not_needed')).toBe(true)
  })

  it('blocks water in an anhydrous format', () => {
    const report = checkFormulaDraft({
      ...base,
      format: 'face_oil',
      rows: [row('Aqua', 'Solvent', 'A', 50), row('Squalane', 'Emollient', 'A', 49.5), row('Tocopherol', 'Antioxidant', 'B', 0.5)],
    })
    expect(report.issues.some((i) => i.code === 'water_in_anhydrous')).toBe(true)
  })

  it('passes a real oil perfume and lists its allergens and shelf gaps', () => {
    const report = checkFormulaDraft({
      format: 'oil_perfume',
      productType: 'perfume',
      markets: ['EU'],
      rules: SEED_RULES,
      rows: goodOilPerfume,
      inventory: [{ inci: 'Tocopherol', stockStatus: 'in_house', animalDerived: 'no', originType: 'natural', organicCertified: 'unknown' }],
    })
    expect(report.issues.filter((i) => i.severity === 'block')).toEqual([])
    expect(report.allergens).toContain('Geraniol')
    expect(report.roles.find((r) => r.role === 'fixative')?.status).toBe('filled')
    expect(report.toOrder.map((i) => i.inci)).toContain('Rosa Damascena Flower Oil')
    expect(report.toOrder.map((i) => i.inci)).not.toContain('Tocopherol')
  })

  it('rejects a perfume whose concentrate is far too weak', () => {
    const weak = goodOilPerfume.map((r) => (r.inci === 'Simmondsia Chinensis Seed Oil' ? r : { ...r, percent: Math.round(r.percent * 25) / 100 }))
    const aroma = weak.filter((r) => r.inci !== 'Simmondsia Chinensis Seed Oil').reduce((sum, r) => sum + r.percent, 0)
    const rows = weak.map((r) => (r.inci === 'Simmondsia Chinensis Seed Oil' ? { ...r, percent: Math.round((100 - aroma) * 100) / 100 } : r))
    const report = checkFormulaDraft({ format: 'oil_perfume', productType: 'perfume', markets: ['EU'], rows })
    const issue = report.issues.find((i) => i.code === 'role_below_band' && i.role === 'aroma_material')
    expect(issue?.severity).toBe('block')
    expect(issue?.message).toContain('raise')
  })

  it('tells the model exactly how to fix the balance row', () => {
    const rows = goodCream.map((r) => (r.inci === 'Aqua' ? { ...r, percent: 60 } : r))
    const report = checkFormulaDraft({ ...base, format: 'cream', rows })
    expect(report.issues.find((i) => i.code === 'total_not_100')?.message).toContain('Set Aqua to 66.6%')
  })

  it('rejects the one-row "Fragrance" perfume', () => {
    const report = checkFormulaDraft({
      format: 'oil_perfume',
      productType: 'perfume',
      markets: ['EU'],
      rules: SEED_RULES,
      rows: [
        row('Fragrance', 'Fragrance', 'Fragrance', 16),
        row('Linalool', 'Fragrance allergen', 'Fragrance', 0.06),
        row('Coumarin', 'Fragrance material', 'Fragrance', 0.2),
        row('Butylphenyl Methylpropional', 'Fragrance material', 'Fragrance', 0.02),
        row('Caprylic/Capric Triglyceride', 'Carrier', 'Oil', 83.72),
      ],
    })
    expect(report.ok).toBe(false)
    const codes = report.issues.filter((i) => i.severity === 'block').map((i) => i.code)
    expect(codes).toContain('fragrance_blob_in_perfume')
    expect(codes).toContain('role_too_few_rows')
    expect(codes).toContain('regulatory') // Lilial ban
  })

  it('blocks animal-derived materials on a vegan product', () => {
    const report = checkFormulaDraft({
      ...base,
      format: 'balm',
      claims: ['vegan'],
      rows: [
        row('Cera Alba', 'Wax', 'A', 15),
        row('Butyrospermum Parkii Butter', 'Butter', 'A', 30),
        row('Simmondsia Chinensis Seed Oil', 'Emollient', 'A', 54.5),
        row('Tocopherol', 'Antioxidant', 'B', 0.5),
      ],
    })
    expect(report.issues.some((i) => i.code === 'claim' && i.severity === 'block' && i.inci === 'Cera Alba')).toBe(true)
  })

  it('describes the report for the model', () => {
    const report = checkFormulaDraft({ ...base, format: 'cream', rows: goodCream.slice(0, 5) })
    const text = describeDraftReport(report)
    expect(text).toContain('Fix before proposing again')
    expect(text).toContain('Roles still empty')
  })
})

describe('buildFormulationGuide', () => {
  it('keeps the same shortlist when a material outside it becomes in stock', () => {
    const full = buildFormulationGuide({ format: 'edp', candidatesPerRole: 60 })
    const aromas = full.roles.find((role) => role.role === 'aroma_material')!.candidates
    expect(aromas.length).toBeGreaterThan(1)
    const stocked = aromas[aromas.length - 1].inci
    const before = buildFormulationGuide({ format: 'edp', candidatesPerRole: 1 })
    const after = buildFormulationGuide({
      format: 'edp',
      candidatesPerRole: 1,
      inventory: [{ inci: stocked, stockStatus: 'in_house', animalDerived: 'unknown', originType: 'unknown', organicCertified: 'unknown' }],
    })
    expect(after.roles.map((role) => role.candidates.map((candidate) => candidate.inci)))
      .toEqual(before.roles.map((role) => role.candidates.map((candidate) => candidate.inci)))
  })

  it('lists candidates per role with stock flags and keeps vegan clean', () => {
    const guide = buildFormulationGuide({
      format: 'balm',
      claims: ['vegan'],
      inventory: [
        { inci: 'Cera Alba', stockStatus: 'in_house', animalDerived: 'yes', originType: 'natural', organicCertified: 'unknown', category: 'emollient' },
        { inci: 'Shea Butter', stockStatus: 'low', animalDerived: 'no', originType: 'natural', organicCertified: 'unknown', category: 'emollient' },
      ],
    })
    const wax = guide.roles.find((r) => r.role === 'wax')!
    expect(wax.candidates.map((c) => c.inci)).not.toContain('Cera Alba')
    expect(wax.candidates.map((c) => c.inci)).toContain('Euphorbia Cerifera Cera')
    const butter = guide.roles.find((r) => r.role === 'butter')!
    expect(butter.candidates.find((c) => c.inci === 'Butyrospermum Parkii Butter')?.stock).toBe('low')
    expect(guide.checklist.some((line) => line.includes('Stock is a flag'))).toBe(true)
  })

  it('adds shelf-only materials as candidates for the matching role', () => {
    const guide = buildFormulationGuide({
      format: 'cream',
      inventory: [{ inci: 'MadeUpine', stockStatus: 'in_house', animalDerived: 'no', originType: 'unknown', organicCertified: 'unknown', category: 'active' }],
    })
    const active = guide.roles.find((r) => r.role === 'active')!
    expect(active.candidates.find((c) => c.inci === 'MadeUpine')?.fromShelf).toBe(true)
  })
})
