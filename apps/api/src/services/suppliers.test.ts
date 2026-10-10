import { describe, expect, it } from 'vitest'
import { groupPurchaseSuggestionsBySupplier } from '@formulario/domain'

describe('supplier purchase grouping (API contract)', () => {
  it('keeps order-list grouping stable for Home', () => {
    const groups = groupPurchaseSuggestionsBySupplier([
      {
        inci: 'Shea Butter',
        reason: 'low',
        usedIn: ['Cream'],
        supplierId: 'a',
        supplierName: 'Aroma Zone',
        pricePerKg: 16,
      },
      { inci: 'Mystery', reason: 'missing', usedIn: ['Oil'] },
    ])
    expect(groups).toHaveLength(2)
    expect(groups[0]?.supplierName).toBe('Aroma Zone')
    expect(groups[1]?.supplierId).toBeNull()
  })
})
