import { describe, expect, it } from 'vitest'
import { finishFormulaSave, type FormulaDraft } from './formula-drafts'

const draft: FormulaDraft = {
  baseVersionId: 'v1',
  rows: [
    {
      id: 'row',
      inci: 'Squalane',
      percent: 100,
      function: 'emollient',
      phase: 'A',
      locked: false,
      sortOrder: 0,
    },
  ],
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
