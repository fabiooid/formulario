import { z } from 'zod'
import { findMaterial } from './materials.ts'
import { normalizeInci } from '../types.ts'

// Curated excerpts only. Documents are evidence, never instructions for the agent.
// Source checking means the passage supports the claim, not that a formula is validated.
export const MaterialEvidenceSchema = z.object({
  id: z.string().min(1),
  libraryInci: z.string().min(1),
  supplier: z.string().min(1),
  suppliedProduct: z.string().min(1),
  suppliedConcentration: z.string().nullable(),
  source: z.object({
    title: z.string().min(1),
    url: z.string().url(),
    revision: z.string().nullable(),
    accessedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    locator: z.string().min(1),
    excerpt: z.string().min(1),
  }),
  claim: z.object({
    property: z.enum(['olfactive_profile', 'solubility', 'processing', 'compatibility', 'use_level']),
    statement: z.string().min(1),
    conditions: z.string().min(1),
    numerical: z.object({
      value: z.number(),
      unit: z.string().min(1),
      basis: z.enum(['supplied_material', 'concentrate', 'finished_product']),
    }).optional(),
  }),
  review: z.literal('source_checked'),
  limitations: z.array(z.string().min(1)).min(1),
})
export type MaterialEvidence = z.infer<typeof MaterialEvidenceSchema>

export const MATERIAL_EVIDENCE: MaterialEvidence[] = [
  MaterialEvidenceSchema.parse({
    id: 'iff-iso-e-super-olfactive',
    libraryInci: 'Tetramethyl Acetyloctahydronaphthalenes',
    supplier: 'IFF',
    suppliedProduct: 'Iso E Super®',
    suppliedConcentration: null,
    source: {
      title: 'Iso E Super® — IFF Fragrance Ingredients Compendium',
      url: 'https://www.iff.com/scent/ingredients-compendium/iso-e-super/',
      revision: null,
      accessedAt: '2026-09-11',
      locator: 'Olfactive Description',
      excerpt: 'Smooth, woody, amber with unique aspects giving a "velvet" like sensation.',
    },
    claim: {
      property: 'olfactive_profile',
      statement: 'IFF describes its Iso E Super product as woody and ambery with a soft tactile impression.',
      conditions: 'Qualitative manufacturer description of IFF Iso E Super; not a prediction of a blend.',
    },
    review: 'source_checked',
    limitations: [
      'Applies to the named supplier product; an INCI or alias match does not establish an equivalent grade or dilution.',
      'No concentration basis verified. Do not interpret supplier typical usage as a finished-product limit.',
      'Does not verify the library use band, maximum, solubility, safety, regulatory status, or performance of a proposed formula.',
    ],
  }),
]

export function searchMaterialEvidence(query: string, limit = 8): MaterialEvidence[] {
  const q = normalizeInci(query).trim()
  if (!q) return MATERIAL_EVIDENCE.slice(0, limit)
  const material = findMaterial(query)
  return MATERIAL_EVIDENCE.filter((record) =>
    (material && record.libraryInci === material.inci) ||
    normalizeInci([
      record.libraryInci, record.supplier, record.suppliedProduct,
      record.claim.property, record.claim.statement,
    ].join(' ')).includes(q),
  ).slice(0, limit)
}

export function materialEvidenceSummary(inci: string) {
  const material = findMaterial(inci)
  const related = material
    ? MATERIAL_EVIDENCE.filter((record) => record.libraryInci === material.inci)
    : []
  return {
    libraryGuidance: 'unverified' as const,
    relatedSourceIds: related.map((record) => record.id),
    documentedProperties: [...new Set(related.map((record) => record.claim.property))],
    applicability: 'Check the exact supplier product and supplied concentration before applying evidence.',
  }
}
