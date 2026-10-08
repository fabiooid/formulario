import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { NO_OFFICIAL_LIST, runRegulatoryChecks } from './engine.ts'
import { parseEuAnnexII } from './eu-annex-ii.ts'
import type { IngredientRule } from '../types.ts'

const annex = parseEuAnnexII(
  readFileSync(new URL('../../data/eu-annex-ii.csv', import.meta.url), 'utf8'),
)

const sampleBan: IngredientRule = {
  id: 'eu-annex-ii-sample',
  version: 'cosing-annex-ii-2026-09-29',
  market: 'EU',
  instrument: 'EU Annex II',
  substance: 'Sample banned substance',
  inciNames: ['Butylphenyl Methylpropional'],
  casNumbers: ['80-54-6'],
  effect: 'cannot_sell',
  citationUrl: 'https://ec.europa.eu/growth/tools-databases/cosing/reference/annexes/list/II',
  message: 'On the EU banned list.',
}

describe('official ban checks', () => {
  it('reads the Commission Annex II export and flags a listed name', () => {
    expect(annex.listUpdatedOn).toBe('2026-09-29')
    expect(annex.entryCount).toBeGreaterThan(1000)
    expect(annex.rules.some((rule) => rule.inciNames.includes('BUTYLPHENYL METHYLPROPIONAL'))).toBe(true)
    expect(new Set(annex.rules.map((rule) => rule.id)).size).toBe(annex.rules.length)

    const results = runRegulatoryChecks({
      rows: [{ inci: 'Butylphenyl Methylpropional', percent: 0.02, phase: 'Fragrance' }],
      markets: ['EU'],
      productType: 'perfume',
      rules: annex.rules,
    })

    expect(results[0]?.status).toBe('banned')
    expect(results[0]?.hits[0]?.instrument).toBe('EU Annex II')
    expect(results[0]?.hits[0]?.citationUrl).toContain('cosing')
  })

  it('matches a CAS number printed on the official row', () => {
    const results = runRegulatoryChecks({
      rows: [{ inci: 'Trade name only', cas: '80-54-6', percent: 0.02, phase: 'Fragrance' }],
      markets: ['EU'],
      productType: 'perfume',
      rules: [sampleBan],
    })

    expect(results[0]?.status).toBe('banned')
  })

  it('does not call an unmatched name allowed', () => {
    const results = runRegulatoryChecks({
      rows: [{ inci: 'Glycerin', percent: 5, phase: 'Water' }],
      markets: ['EU'],
      productType: 'skincare',
      rules: [sampleBan],
    })

    expect(results[0]?.status).toBe('not_listed')
    expect(results[0]?.hits).toEqual([])
  })

  it('says a country with no loaded list was not checked', () => {
    const results = runRegulatoryChecks({
      rows: [{ inci: 'Glycerin', percent: 5, phase: 'Water' }],
      markets: ['ASEAN'],
      productType: 'skincare',
      rules: [sampleBan],
    })

    expect(results[0]?.status).toBe('unknown')
    expect(results[0]?.hits[0]?.instrument).toBe(NO_OFFICIAL_LIST)
  })
})
