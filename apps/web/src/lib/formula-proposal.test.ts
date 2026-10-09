import { describe, expect, it } from 'vitest'
import { isPatchStale, proposedFormulaRows } from './formula-proposal'
import type { FormulaRow } from '@formulario/domain'

const row = (overrides: Partial<FormulaRow> & { id: string }): FormulaRow => ({
  inci: 'Squalane',
  function: 'emollient',
  phase: 'A',
  percent: 100,
  sortOrder: 0,
  ...overrides,
})

describe('proposedFormulaRows', () => {
  it('shows the full formula after the pending operations', () => {
    const committed = [
      row({ id: 'a', inci: 'Squalane', percent: 90, sortOrder: 0 }),
      row({ id: 'b', inci: 'Water', percent: 10, sortOrder: 1 }),
    ]
    const proposed = proposedFormulaRows(committed, [
      { op: 'update', rowId: 'a', changes: { percent: 80 } },
      { op: 'remove', rowId: 'b' },
      {
        op: 'add',
        row: { inci: 'Glycerin', function: 'humectant', phase: 'A', percent: 20 },
      },
    ])

    expect(proposed.map((r) => ({ inci: r.inci, percent: r.percent }))).toEqual([
      { inci: 'Squalane', percent: 80 },
      { inci: 'Glycerin', percent: 20 },
    ])
  })
})

describe('isPatchStale', () => {
  it('flags a proposal based on an older version', () => {
    expect(isPatchStale({ baseVersionId: 'v1' }, 'v1')).toBe(false)
    expect(isPatchStale({ baseVersionId: 'v1' }, 'v2')).toBe(true)
    expect(isPatchStale({ baseVersionId: null }, 'v1')).toBe(true)
  })
})
