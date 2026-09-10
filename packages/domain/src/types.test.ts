import { describe, expect, it } from 'vitest'
import {
  computeMacerationStatus,
  computeProductStage,
  collectPurchaseSuggestions,
  findInventoryMatch,
  generateInciList,
  isWaterInci,
  normalizeProductClaims,
  ProductCreatePayloadSchema,
  type FormulaRow,
} from './types.ts'

describe('isWaterInci', () => {
  it('matches the usual spellings of water', () => {
    expect(isWaterInci('Aqua')).toBe(true)
    expect(isWaterInci(' WATER ')).toBe(true)
    expect(isWaterInci('Aqua (Water)')).toBe(true)
  })

  it('does not match ingredients that only contain the word', () => {
    expect(isWaterInci('Aquaxyl')).toBe(false)
    expect(isWaterInci('Rosa Damascena Flower Water')).toBe(false)
  })
})

describe('generateInciList', () => {
  it('lists by descending percent, merges duplicates and puts colourants last', () => {
    const list = generateInciList([
      { inci: 'CI 77891', percent: 2 },
      { inci: 'Glycerin', percent: 3 },
      { inci: 'Aqua', percent: 80 },
      { inci: 'Parfum', percent: 0.5 },
      { inci: 'glycerin', percent: 2 },
      { inci: 'Linalool', percent: 0.8 },
    ])

    expect(list).toBe('Aqua, Glycerin, Linalool, Parfum, CI 77891')
  })

  it('skips empty rows', () => {
    expect(generateInciList([{ inci: '', percent: 10 }, { inci: 'Aqua', percent: 90 }])).toBe('Aqua')
  })
})

const row = (inci: string): FormulaRow => ({
  id: '1',
  inci,
  function: 'Test',
  phase: 'A',
  percent: 100,
  locked: false,
  sortOrder: 0,
})

describe('computeMacerationStatus', () => {
  it('returns fresh when not started', () => {
    expect(computeMacerationStatus(null, null)).toBe('fresh')
  })

  it('returns macerating before target date', () => {
    const started = new Date(Date.now() - 86400000).toISOString()
    const target = new Date(Date.now() + 86400000 * 7).toISOString()
    expect(computeMacerationStatus(started, target)).toBe('macerating')
  })

  it('returns ready after target date', () => {
    const started = new Date(Date.now() - 86400000 * 14).toISOString()
    const target = new Date(Date.now() - 86400000).toISOString()
    expect(computeMacerationStatus(started, target)).toBe('ready')
  })
})

describe('computeProductStage', () => {
  it('returns idea when no rows', () => {
    expect(
      computeProductStage({
        variants: [{ rows: [], isSelectedFinal: false }],
      }),
    ).toBe('idea')
  })

  it('returns formula when rows exist but no final', () => {
    expect(
      computeProductStage({
        variants: [{ rows: [row('Aqua')], isSelectedFinal: false }],
      }),
    ).toBe('formula')
  })

  it('returns final when a variant is selected final with rows', () => {
    expect(
      computeProductStage({
        variants: [
          { rows: [row('Aqua')], isSelectedFinal: false },
          { rows: [row('Fragrance')], isSelectedFinal: true },
        ],
      }),
    ).toBe('final')
  })
})

describe('normalizeProductClaims', () => {
  it('keeps vegan, natural, and organic in a stable order', () => {
    expect(normalizeProductClaims(['organic', 'vegan', 'natural', 'vegan', 'km0'])).toEqual([
      'vegan',
      'natural',
      'organic',
    ])
  })
})

describe('findInventoryMatch', () => {
  it('matches INCI names without caring about case or extra spaces', () => {
    expect(
      findInventoryMatch('  Squalane ', [{ inci: 'squalane' }])?.inci,
    ).toBe('squalane')
  })

  it('returns undefined when the ingredient is not in stock', () => {
    expect(findInventoryMatch('MadeUpine', [{ inci: 'Squalane' }])).toBeUndefined()
  })
})

describe('collectPurchaseSuggestions', () => {
  it('flags formula ingredients that are not in the inventory', () => {
    const suggestions = collectPurchaseSuggestions(
      [{ inci: 'MadeUpine', productName: 'Face oil' }],
      [{ inci: 'Squalane', stockStatus: 'in_house' }],
    )
    expect(suggestions).toEqual([
      { inci: 'MadeUpine', reason: 'missing', usedIn: ['Face oil'] },
    ])
  })

  it('flags low and to-buy stock, including unused planned buys', () => {
    const suggestions = collectPurchaseSuggestions(
      [{ inci: 'Coumarin', productName: 'No. 3' }],
      [
        { inci: 'Coumarin', stockStatus: 'low' },
        { inci: 'Vanilla Absolute', stockStatus: 'to_buy' },
      ],
    )
    expect(suggestions.map((item) => item.reason)).toEqual(['to_buy', 'low'])
  })

  it('can ignore unused planned buys when checking a formula', () => {
    const suggestions = collectPurchaseSuggestions(
      [{ inci: 'Coumarin', productName: 'No. 3' }],
      [
        { inci: 'Coumarin', stockStatus: 'low' },
        { inci: 'Vanilla Absolute', stockStatus: 'to_buy' },
      ],
      { includeUnused: false },
    )
    expect(suggestions).toEqual([{ inci: 'Coumarin', reason: 'low', usedIn: ['No. 3'] }])
  })

  it('keeps a unit price when the inventory has one', () => {
    const suggestions = collectPurchaseSuggestions(
      [{ inci: 'Vanilla Absolute', productName: 'No. 3' }],
      [{ inci: 'Vanilla Absolute', stockStatus: 'to_buy', pricePerKg: 980 }],
    )
    expect(suggestions[0]?.pricePerKg).toBe(980)
  })
})

describe('ProductCreatePayloadSchema', () => {
  it('keeps formula rows on a new product proposal', () => {
    const parsed = ProductCreatePayloadSchema.parse({
      name: 'Santul',
      type: 'perfume',
      brief: 'Smoky santal',
      formula: [
        {
          inci: 'Caprylic/Capric Triglyceride',
          function: 'Carrier',
          phase: 'A',
          percent: '75',
        },
      ],
    })
    expect(parsed.formula).toHaveLength(1)
    expect(parsed.formula?.[0]?.percent).toBe(75)
  })
})
