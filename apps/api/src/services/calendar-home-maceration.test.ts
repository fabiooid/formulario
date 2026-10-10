import { describe, expect, it } from 'vitest'
import { buildCalendarDashboard } from './calendar.js'
import { buildHomeDashboard } from './home.js'
import type { IngredientRule } from '@formulario/domain'

const now = Date.parse('2026-10-10T12:00:00.000Z')
const started = new Date(now - 7 * 86_400_000).toISOString()
const target = new Date(now + 21 * 86_400_000).toISOString()

/**
 * Same shape Home tests use for perfume variants: one hidden trial with
 * maceration, one selected-final (visible) version with maceration.
 */
function perfumeCatalog() {
  return [
    {
      product: {
        id: 'prod-perfume',
        name: 'No. 3 Oil Perfume',
        type: 'perfume' as const,
        markets: ['EU'],
        claims: [] as [],
      },
      variants: [
        {
          variant: { id: 'var-softer', label: 'Softer', isSelectedFinal: false },
          version: {
            id: 'ver-softer',
            label: 'softer',
            versionNumber: 1,
            isFinal: false,
            macerationStatus: 'macerating' as const,
            macerationStartedAt: started,
            macerationTargetAt: target,
          },
          rows: [{ inci: 'Fragrance', percent: 100, phase: 'Oil' }],
          versions: [
            {
              id: 'ver-softer',
              label: 'softer',
              versionNumber: 1,
              isFinal: false,
              isCurrent: true,
              macerationStatus: 'macerating' as const,
              macerationStartedAt: started,
              macerationTargetAt: target,
              rows: [{ inci: 'Fragrance', percent: 100, phase: 'Oil' }],
            },
          ],
        },
        {
          variant: { id: 'var-original', label: 'Original', isSelectedFinal: true },
          version: {
            id: 'ver-original',
            label: 'original',
            versionNumber: 1,
            isFinal: true,
            macerationStatus: 'macerating' as const,
            macerationStartedAt: started,
            macerationTargetAt: target,
          },
          rows: [{ inci: 'Fragrance', percent: 100, phase: 'Oil' }],
          versions: [
            {
              id: 'ver-original',
              label: 'original',
              versionNumber: 1,
              isFinal: true,
              isCurrent: true,
              macerationStatus: 'macerating' as const,
              macerationStartedAt: started,
              macerationTargetAt: target,
              rows: [{ inci: 'Fragrance', percent: 100, phase: 'Oil' }],
            },
          ],
        },
      ],
    },
  ]
}

describe('Home and Calendar maceration visibility', () => {
  it('use the same visible-variant rule (selected-final only)', () => {
    const catalog = perfumeCatalog()
    const home = buildHomeDashboard({
      catalog,
      inventory: [],
      rules: [] as IngredientRule[],
      now,
    })
    const calendar = buildCalendarDashboard({
      catalog: catalog.map((item) => ({
        product: {
          id: item.product.id,
          name: item.product.name,
          type: item.product.type,
        },
        variants: item.variants.map((variant) => ({
          variant: { isSelectedFinal: variant.variant.isSelectedFinal },
          versions: variant.versions.map((version) => ({
            id: version.id,
            label: version.label,
            versionNumber: version.versionNumber,
            macerationStatus: version.macerationStatus,
            macerationTargetAt: version.macerationTargetAt,
          })),
        })),
      })),
      inventory: [],
      now,
    })

    const homeMaceration = home.attention.filter(
      (item) => item.kind === 'macerating' || item.kind === 'maceration_ready',
    )
    expect(homeMaceration).toHaveLength(1)
    expect(homeMaceration[0]?.href).toBe('/products/prod-perfume?version=ver-original')
    expect(homeMaceration[0]?.versionLabel).toBe('original')

    expect(calendar.maceration).toHaveLength(1)
    expect(calendar.maceration[0]?.href).toBe('/products/prod-perfume?version=ver-original')
    expect(calendar.maceration[0]?.versionLabel).toBe('original')
    expect(calendar.maceration[0]?.daysLeft).toBe(homeMaceration[0]?.daysLeft)
    expect(calendar.maceration.map((item) => item.id)).not.toContain('macerating-ver-softer')
  })
})
