import { applyPatchOperations, type FormulaRow, type PatchOperation } from '@formulario/domain'

/** Build the formula the person would commit if they accept this pending patch. */
export function proposedFormulaRows(
  committedRows: FormulaRow[],
  operations: PatchOperation[],
): FormulaRow[] {
  return applyPatchOperations(committedRows, operations)
}

export function isPatchStale(
  patch: { baseVersionId?: string | null },
  currentVersionId: string | null | undefined,
): boolean {
  if (!patch.baseVersionId) return true
  if (!currentVersionId) return true
  return patch.baseVersionId !== currentVersionId
}
