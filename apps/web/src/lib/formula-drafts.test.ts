import { describe, expect, it } from 'vitest'
import { formulaContentEquals } from './formula-drafts'
import type { FormulaRow } from './api'

const row = (overrides: Partial<FormulaRow> = {}): FormulaRow => ({
  id: 'row',
  inci: 'Squalane',
  percent: 100,
  function: 'emollient',
  phase: 'A',
  sortOrder: 0,
  ...overrides,
})

describe('comparing formula content', () => {
  it('treats only identical rows as the same formula', () => {
    expect(formulaContentEquals([row()], [row()])).toBe(true)
    expect(formulaContentEquals([row()], [row({ percent: 90 })])).toBe(false)
  })
})
