import { describe, expect, it } from 'vitest'
import { finishFormulaSave, formulaContentEquals, type FormulaDraft } from './formula-drafts'
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

const draft: FormulaDraft = {
  baseVersionId: 'v1',
  rows: [row()],
}

describe('saving formula drafts', () => {
  it('clears only the saved variant and keeps other variant drafts', () => {
    expect(finishFormulaSave({ a: draft, b: draft }, 'a', draft, 'v2')).toEqual({ b: draft })
  })

  it('keeps edits made during a save and bases their next save on the returned version', () => {
    const newer = { ...draft, rows: [{ ...draft.rows[0], percent: 90 }] }
    expect(finishFormulaSave({ a: newer }, 'a', draft, 'v2')).toEqual({
      a: { ...newer, baseVersionId: 'v2' },
    })
  })
})

describe('comparing formula content', () => {
  it('treats only identical rows as the same formula', () => {
    expect(formulaContentEquals([row()], [row()])).toBe(true)
    expect(formulaContentEquals([row()], [row({ percent: 90 })])).toBe(false)
  })
})
