import type { FormulaRow } from './api'

export type FormulaDraft = { rows: FormulaRow[]; baseVersionId: string | null }
export type FormulaDrafts = Record<string, FormulaDraft>

// A completed save only clears the snapshot it submitted. Edits made while the
// request was in flight remain a draft, based on the newly committed version.
export function finishFormulaSave(
  drafts: FormulaDrafts,
  variantId: string,
  submitted: FormulaDraft,
  versionId: string,
): FormulaDrafts {
  const current = drafts[variantId]
  if (!current) return drafts
  const next = { ...drafts }
  if (JSON.stringify(current.rows) === JSON.stringify(submitted.rows)) delete next[variantId]
  else next[variantId] = { ...current, baseVersionId: versionId }
  return next
}
