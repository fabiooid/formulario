import type { FormulaRow, Workspace } from './api'

export type FormulaDraft = { rows: FormulaRow[]; baseVersionId: string | null }
export type FormulaDrafts = Record<string, FormulaDraft>
export type FormulaLockChange = { rowId: string; locked: boolean }

function withoutLocks(rows: FormulaRow[]) {
  return rows.map(({ locked: _locked, ...row }) => row)
}

export function formulaContentEquals(a: FormulaRow[], b: FormulaRow[]) {
  return JSON.stringify(withoutLocks(a)) === JSON.stringify(withoutLocks(b))
}

export function formulaLockChanges(from: FormulaRow[], to: FormulaRow[]): FormulaLockChange[] {
  const previousById = new Map(from.map((row) => [row.id, row]))
  const changes: FormulaLockChange[] = []
  for (const row of to) {
    const previous = previousById.get(row.id)
    if (previous && previous.locked !== row.locked) {
      changes.push({ rowId: row.id, locked: row.locked })
    }
  }
  return changes
}

export function applyFormulaRowLock(
  workspace: Workspace | undefined,
  variantId: string,
  rowId: string,
  locked: boolean,
): Workspace | undefined {
  if (!workspace) return workspace
  return {
    ...workspace,
    variants: workspace.variants.map((entry) =>
      entry.variant.id !== variantId
        ? entry
        : {
            ...entry,
            rows: entry.rows.map((row) => (row.id === rowId ? { ...row, locked } : row)),
          },
    ),
  }
}

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
