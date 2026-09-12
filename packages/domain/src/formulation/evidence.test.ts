import { describe, expect, it } from 'vitest'
import { buildFormulationGuide } from './guide.ts'
import { MATERIAL_EVIDENCE, MaterialEvidenceSchema, materialEvidenceSummary, searchMaterialEvidence } from './evidence.ts'

describe('material evidence', () => {
  it('retrieves supplier evidence by library alias without claiming generic equivalence', () => {
    const [record] = searchMaterialEvidence('Iso E Super')
    expect(record.supplier).toBe('IFF')
    expect(record.suppliedProduct).toBe('Iso E Super®')
    expect(record.suppliedConcentration).toBeNull()
    expect(record.claim.property).toBe('olfactive_profile')
    expect(record.claim.numerical).toBeUndefined()
    const summary = materialEvidenceSummary(record.libraryInci)
    expect(summary.libraryGuidance).toBe('unverified')
    expect(summary.documentedProperties).toEqual(['olfactive_profile'])
    expect(summary.applicability).toContain('exact supplier')
  })

  it('does not fabricate evidence for missing materials or unsupported properties', () => {
    expect(searchMaterialEvidence('MadeUpine')).toEqual([])
    expect(searchMaterialEvidence('solubility')).toEqual([])
    expect(materialEvidenceSummary('Tocopherol').relatedSourceIds).toEqual([])
    expect(materialEvidenceSummary('Timbersilk').relatedSourceIds).toEqual([])
  })

  it('requires a traceable source and units/basis for numerical evidence', () => {
    const record = MATERIAL_EVIDENCE[0]
    expect(MaterialEvidenceSchema.safeParse({ ...record, source: { ...record.source, url: '' } }).success).toBe(false)
    expect(MaterialEvidenceSchema.safeParse({
      ...record, claim: { ...record.claim, numerical: { value: 10 } },
    }).success).toBe(false)
  })

  it('labels both library and shelf-only guide candidates unverified', () => {
    const guide = buildFormulationGuide({
      format: 'cream',
      inventory: [{ inci: 'MadeUpine', stockStatus: 'in_house', category: 'active' }],
    })
    const candidates = guide.roles.flatMap((role) => role.candidates)
    expect(candidates.length).toBeGreaterThan(0)
    expect(candidates.every((candidate) => candidate.evidence.libraryGuidance === 'unverified')).toBe(true)
    expect(candidates.find((candidate) => candidate.inci === 'MadeUpine')?.evidence.relatedSourceIds).toEqual([])
  })
})
