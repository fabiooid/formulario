import { describe, expect, it } from 'vitest'
import { buildCalendarDashboard } from './calendar.js'

const now = Date.parse('2026-10-10T12:00:00.000Z')

describe('buildCalendarDashboard', () => {
  it('lists maceration only for versions on the visible variant', () => {
    const result = buildCalendarDashboard({
      now,
      catalog: [
        {
          product: { id: 'p1', name: 'No. 3', type: 'perfume' },
          variants: [
            {
              variant: { isSelectedFinal: true },
              versions: [
                {
                  id: 'v-visible',
                  label: 'v1',
                  versionNumber: 1,
                  macerationStatus: 'macerating',
                  macerationTargetAt: '2026-10-31T00:00:00.000Z',
                },
              ],
            },
            {
              variant: { isSelectedFinal: false },
              versions: [
                {
                  id: 'v-hidden',
                  label: 'old trial',
                  versionNumber: 1,
                  macerationStatus: 'ready',
                  macerationTargetAt: '2026-09-01T00:00:00.000Z',
                },
              ],
            },
          ],
        },
      ],
      inventory: [],
    })

    expect(result.maceration).toHaveLength(1)
    expect(result.maceration[0]?.id).toBe('macerating-v-visible')
    expect(result.maceration[0]?.href).toContain('version=v-visible')
    expect(result.maceration[0]?.date).toBe('2026-10-31')
  })

  it('never invents a stock run-out date', () => {
    const result = buildCalendarDashboard({
      now,
      catalog: [],
      inventory: [
        { id: 'i1', inci: 'Coumarin', stockStatus: 'low', onHandGrams: 15 },
        { id: 'i2', inci: 'Vanilla Absolute', stockStatus: 'to_buy', onHandGrams: 0 },
        { id: 'i3', inci: 'Squalane', stockStatus: 'in_house', onHandGrams: 250 },
      ],
    })

    expect(result.stock).toHaveLength(2)
    expect(result.stock.every((item) => item.date === null)).toBe(true)
    expect(result.stock.every((item) => item.canEstimateRunOut === false)).toBe(true)
    expect(result.stock.map((item) => item.inci)).toEqual(['Vanilla Absolute', 'Coumarin'])
  })

  it('skips maceration for non-perfume products', () => {
    const result = buildCalendarDashboard({
      now,
      catalog: [
        {
          product: { id: 'p2', name: 'Cream', type: 'skincare' },
          variants: [
            {
              variant: { isSelectedFinal: true },
              versions: [
                {
                  id: 'v1',
                  versionNumber: 1,
                  macerationStatus: 'macerating',
                  macerationTargetAt: '2026-11-01T00:00:00.000Z',
                },
              ],
            },
          ],
        },
      ],
      inventory: [],
    })
    expect(result.maceration).toEqual([])
  })
})
