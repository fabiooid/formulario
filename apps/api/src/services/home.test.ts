import { describe, expect, it } from 'vitest'
import {
  buildHomeDashboard,
  daysUntil,
  macerationProgress,
  pickActiveFormulaRows,
  pickCostVariant,
  pickVisibleVariant,
} from './home.js'
import type { IngredientRule, ProductClaim } from '@formulario/domain'

const lilialBan: IngredientRule = {
  id: 'rule-lilial',
  version: 'test',
  market: 'EU',
  instrument: 'EU Annex II',
  substance: 'Lilial',
  inciNames: ['Butylphenyl Methylpropional'],
  effect: 'cannot_sell',
  citationUrl: 'https://example.test/lilial',
  message: 'Banned in the EU',
  productTypes: ['perfume', 'skincare', 'hybrid'],
}

function version(input: {
  id: string
  label: string
  isFinal?: boolean
  isCurrent?: boolean
  rows: Array<{ inci: string; percent: number; phase?: string }>
  macerationStatus?: 'fresh' | 'macerating' | 'ready'
  macerationStartedAt?: string
  macerationTargetAt?: string
}) {
  return {
    id: input.id,
    label: input.label,
    versionNumber: 1,
    isFinal: input.isFinal ?? false,
    isCurrent: input.isCurrent ?? true,
    macerationStatus: input.macerationStatus,
    macerationStartedAt: input.macerationStartedAt ?? null,
    macerationTargetAt: input.macerationTargetAt ?? null,
    rows: input.rows.map((row) => ({ ...row, phase: row.phase ?? 'Oil' })),
  }
}

function catalogItem(input: {
  id: string
  name: string
  type?: 'skincare' | 'perfume' | 'hybrid'
  claims?: ProductClaim[]
  variants: Array<{
    id: string
    label: string
    isSelectedFinal?: boolean
    versions: ReturnType<typeof version>[]
  }>
}) {
  return {
    product: {
      id: input.id,
      name: input.name,
      type: input.type ?? 'skincare',
      markets: ['EU'],
      claims: input.claims ?? [],
    },
    variants: input.variants.map((variant) => {
      const current =
        variant.versions.find((item) => item.isCurrent) ?? variant.versions[0] ?? null
      return {
        variant: {
          id: variant.id,
          label: variant.label,
          isSelectedFinal: variant.isSelectedFinal ?? false,
        },
        version: current
          ? {
              id: current.id,
              label: current.label,
              versionNumber: current.versionNumber,
              isFinal: current.isFinal,
              macerationStatus: current.macerationStatus,
              macerationStartedAt: current.macerationStartedAt,
              macerationTargetAt: current.macerationTargetAt,
            }
          : null,
        rows: current?.rows ?? [],
        versions: variant.versions,
      }
    }),
  }
}

describe('home dashboard rules', () => {
  const now = Date.parse('2026-10-10T12:00:00.000Z')

  it('gates bans and claim blocks on a final version', () => {
    const draft = catalogItem({
      id: 'banned-draft',
      name: 'Banned Draft',
      type: 'perfume',
      claims: ['vegan'],
      variants: [
        {
          id: 'v-main',
          label: 'Main',
          isSelectedFinal: true,
          versions: [
            version({
              id: 'ver-draft',
              label: 'Draft',
              rows: [
                { inci: 'Butylphenyl Methylpropional', percent: 1 },
                { inci: 'Beeswax', percent: 99 },
              ],
            }),
          ],
        },
      ],
    })
    const inventory = [
      {
        inci: 'Beeswax',
        stockStatus: 'in_house' as const,
        animalDerived: 'yes' as const,
        originType: 'natural' as const,
        organicCertified: 'unknown' as const,
      },
    ]

    const withoutFinal = buildHomeDashboard({
      catalog: [draft],
      inventory,
      rules: [lilialBan],
      now,
    })
    expect(withoutFinal.attention.some((item) => item.kind === 'banned')).toBe(false)
    expect(withoutFinal.attention.some((item) => item.kind === 'claim_block')).toBe(false)
    expect(withoutFinal.atRisk.some((item) => item.kind === 'banned')).toBe(false)

    const withFinal = buildHomeDashboard({
      catalog: [
        catalogItem({
          id: 'banned-draft',
          name: 'Banned Draft',
          type: 'perfume',
          claims: ['vegan'],
          variants: [
            {
              id: 'v-main',
              label: 'Main',
              isSelectedFinal: true,
              versions: [
                version({
                  id: 'ver-final',
                  label: 'Final cut',
                  isFinal: true,
                  rows: [
                    { inci: 'Butylphenyl Methylpropional', percent: 1 },
                    { inci: 'Beeswax', percent: 99 },
                  ],
                }),
              ],
            },
          ],
        }),
      ],
      inventory,
      rules: [lilialBan],
      now,
    })
    expect(withFinal.atRisk.map((item) => item.kind)).toContain('banned')
    const banReason = withFinal.atRisk.find((item) => item.kind === 'banned')?.reasons[0]
    expect(banReason).toMatchObject({
      kind: 'banned',
      inci: 'Butylphenyl Methylpropional',
      market: 'EU',
      instrument: 'Annex II',
    })
    expect(withFinal.attention.some((item) => item.kind === 'claim_block')).toBe(true)
    // Ban detail stays on at-risk only (no duplicate in attention).
    expect(withFinal.attention.some((item) => item.kind === 'banned')).toBe(false)
  })

  it('alerts maceration only for versions on the visible variant and deep-links them', () => {
    const started = new Date(now - 7 * 86_400_000).toISOString()
    const target = new Date(now + 21 * 86_400_000).toISOString()
    const dashboard = buildHomeDashboard({
      catalog: [
        catalogItem({
          id: 'prod-perfume',
          name: 'No. 3 Oil Perfume',
          type: 'perfume',
          variants: [
            {
              id: 'var-softer',
              label: 'Softer',
              versions: [
                version({
                  id: 'ver-softer',
                  label: 'softer',
                  macerationStatus: 'macerating',
                  macerationStartedAt: started,
                  macerationTargetAt: target,
                  rows: [{ inci: 'Fragrance', percent: 100 }],
                }),
              ],
            },
            {
              id: 'var-original',
              label: 'Original',
              isSelectedFinal: true,
              versions: [
                version({
                  id: 'ver-original',
                  label: 'original',
                  isFinal: true,
                  macerationStatus: 'macerating',
                  macerationStartedAt: started,
                  macerationTargetAt: target,
                  rows: [{ inci: 'Fragrance', percent: 100 }],
                }),
              ],
            },
          ],
        }),
      ],
      inventory: [],
      rules: [],
      now,
    })

    const macerating = dashboard.attention.filter((item) => item.kind === 'macerating')
    expect(macerating).toHaveLength(1)
    expect(macerating[0]?.versionLabel).toBe('original')
    expect(macerating[0]?.href).toBe('/products/prod-perfume?version=ver-original')
    expect(macerating[0]?.daysLeft).toBe(21)
    expect(macerating[0]?.daysRested).toBe(7)
    expect(macerating[0]?.macerationProgress).toBeCloseTo(0.25, 2)
  })

  it('buy list only includes ingredients that block active or final formulas', () => {
    const dashboard = buildHomeDashboard({
      catalog: [
        catalogItem({
          id: 'face',
          name: 'Face Oil',
          variants: [
            {
              id: 'main',
              label: 'Main',
              isSelectedFinal: true,
              versions: [
                version({
                  id: 'v1',
                  label: 'v1',
                  isFinal: true,
                  rows: [
                    { inci: 'Squalane', percent: 95 },
                    { inci: 'MadeUpine', percent: 5 },
                  ],
                }),
              ],
            },
          ],
        }),
      ],
      inventory: [
        { inci: 'Squalane', stockStatus: 'in_house', pricePerKg: 40, onHandGrams: 100 },
        { inci: 'Vanilla Absolute', stockStatus: 'to_buy', pricePerKg: 980, onHandGrams: 0 },
        { inci: 'Coumarin', stockStatus: 'low', pricePerKg: 32, onHandGrams: 5 },
      ],
      rules: [],
      now,
    })

    expect(dashboard.purchaseSuggestions.map((item) => item.inci)).toEqual(['MadeUpine'])
    expect(dashboard.purchaseCount).toBe(1)
  })

  it('counts full cost only when priced and balanced near 100%', () => {
    const unbalanced = catalogItem({
      id: 'unbalanced',
      name: 'Short Cream',
      variants: [
        {
          id: 'main',
          label: 'Main',
          isSelectedFinal: true,
          versions: [
            version({
              id: 'v1',
              label: 'v1',
              isFinal: true,
              rows: [
                { inci: 'Aqua', percent: 50 },
                { inci: 'Glycerin', percent: 20 },
              ],
            }),
          ],
        },
      ],
    })
    const dashboard = buildHomeDashboard({
      catalog: [unbalanced],
      inventory: [{ inci: 'Glycerin', stockStatus: 'in_house', pricePerKg: 10 }],
      rules: [],
      now,
    })
    expect(dashboard.formulaCosts[0]?.hasGap).toBe(false)
    expect(dashboard.formulaCosts[0]?.balanced).toBe(false)
    expect(dashboard.formulaCosts[0]?.fullCost).toBe(false)
    expect(dashboard.formulaCost.completeCount).toBe(0)
  })

  it('lists each at-risk product once, ordered by severity, without duplicating bans in attention', () => {
    const dashboard = buildHomeDashboard({
      catalog: [
        catalogItem({
          id: 'perfume',
          name: 'Perfume',
          type: 'perfume',
          variants: [
            {
              id: 'main',
              label: 'Main',
              isSelectedFinal: true,
              versions: [
                version({
                  id: 'final',
                  label: 'original',
                  isFinal: true,
                  rows: [
                    { inci: 'Butylphenyl Methylpropional', percent: 1 },
                    { inci: 'Coumarin', percent: 99 },
                  ],
                }),
              ],
            },
          ],
        }),
        catalogItem({
          id: 'oil',
          name: 'Face Oil',
          variants: [
            {
              id: 'main',
              label: 'Main',
              isSelectedFinal: true,
              versions: [
                version({
                  id: 'v1',
                  label: 'v1',
                  isFinal: true,
                  rows: [
                    { inci: 'Squalane', percent: 95 },
                    { inci: 'MadeUpine', percent: 5 },
                  ],
                }),
              ],
            },
          ],
        }),
        catalogItem({
          id: 'cream',
          name: 'Cream',
          variants: [
            {
              id: 'main',
              label: 'Main',
              isSelectedFinal: true,
              versions: [
                version({
                  id: 'v1',
                  label: 'v1',
                  isFinal: true,
                  rows: [{ inci: 'Shea Butter', percent: 100 }],
                }),
              ],
            },
          ],
        }),
      ],
      inventory: [
        { inci: 'Coumarin', stockStatus: 'low', pricePerKg: 32, onHandGrams: 2 },
        { inci: 'Squalane', stockStatus: 'in_house', pricePerKg: 40, onHandGrams: 100 },
        { inci: 'Shea Butter', stockStatus: 'low', pricePerKg: 16, onHandGrams: 10 },
      ],
      rules: [lilialBan],
      now,
    })

    expect(dashboard.atRisk.map((item) => item.kind)).toEqual([
      'banned',
      'missing_ingredient',
      'stock_out',
    ])
    expect(dashboard.atRisk.map((item) => item.productName)).toEqual([
      'Perfume',
      'Face Oil',
      'Cream',
    ])
    const perfume = dashboard.atRisk.find((item) => item.productName === 'Perfume')
    expect(perfume?.href).toContain('tab=regulatory')
    expect(perfume?.reasons.map((reason) => reason.kind)).toEqual(['banned', 'stock_out'])
    expect(perfume?.reasons[0]).toMatchObject({
      inci: 'Butylphenyl Methylpropional',
      market: 'EU',
      instrument: 'Annex II',
    })
    expect(perfume?.reasons[1]).toMatchObject({
      inci: 'Coumarin',
      onHandGrams: 2,
      formulaPercent: 99,
    })
    const oil = dashboard.atRisk.find((item) => item.productName === 'Face Oil')
    expect(oil?.reasons).toEqual([
      expect.objectContaining({
        kind: 'missing_ingredient',
        inci: 'MadeUpine',
        formulaPercent: 5,
      }),
    ])
    const cream = dashboard.atRisk.find((item) => item.productName === 'Cream')
    expect(cream?.reasons).toEqual([
      expect.objectContaining({
        kind: 'stock_out',
        inci: 'Shea Butter',
        onHandGrams: 10,
        formulaPercent: 100,
      }),
    ])
    expect(dashboard.attention.some((item) => item.kind === 'banned')).toBe(false)
    expect(dashboard.attentionTotal).toBe(dashboard.attention.length)
  })

  it('reports zero products so empty purchase copy can stay honest', () => {
    const dashboard = buildHomeDashboard({
      catalog: [],
      inventory: [{ inci: 'Vanilla Absolute', stockStatus: 'to_buy', pricePerKg: 980 }],
      rules: [],
      now,
    })
    expect(dashboard.productCount).toBe(0)
    expect(dashboard.purchaseSuggestions).toEqual([])
  })
})

describe('home helpers', () => {
  it('picks the selected-final variant as visible', () => {
    const visible = pickVisibleVariant([
      { variant: { isSelectedFinal: false } },
      { variant: { isSelectedFinal: true } },
    ])
    expect(visible?.variant.isSelectedFinal).toBe(true)
  })

  it('prefers final rows for cost and active formula', () => {
    const variants = catalogItem({
      id: 'p',
      name: 'P',
      variants: [
        {
          id: 'a',
          label: 'A',
          isSelectedFinal: true,
          versions: [
            version({
              id: 'draft',
              label: 'draft',
              isCurrent: true,
              rows: [{ inci: 'Aqua', percent: 100 }],
            }),
            version({
              id: 'final',
              label: 'final',
              isFinal: true,
              isCurrent: false,
              rows: [{ inci: 'Glycerin', percent: 100 }],
            }),
          ],
        },
      ],
    }).variants
    expect(pickActiveFormulaRows(variants).map((row) => row.inci)).toEqual(['Glycerin'])
    expect(pickCostVariant(variants)?.versionLabel).toBe('final')
  })

  it('computes maceration day math without odd negatives when target is ahead', () => {
    const now = Date.parse('2026-10-10T12:00:00.000Z')
    const target = new Date(now + 21 * 86_400_000).toISOString()
    expect(daysUntil(target, now)).toBe(21)
    expect(
      macerationProgress(
        new Date(now - 7 * 86_400_000).toISOString(),
        target,
        now,
      ),
    ).toBeCloseTo(0.25, 2)
  })
})
