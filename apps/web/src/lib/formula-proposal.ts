import { applyPatchOperations, type FormulaRow, type PatchOperation } from '@formulario/domain'

/**
 * Build the formula the person would commit if they accept this pending patch.
 * Operations arrive from the API as a loose shape; the domain helper expects the
 * discriminated union. Cast at this boundary so `tsc -b` (Docker/Railway) matches
 * the runtime path already used when accepting patches on the API.
 */
export function proposedFormulaRows(
  committedRows: FormulaRow[],
  operations: readonly unknown[],
): FormulaRow[] {
  return applyPatchOperations(committedRows, operations as PatchOperation[])
}

export function isPatchStale(
  patch: { baseVersionId?: string | null },
  currentVersionId: string | null | undefined,
): boolean {
  if (!patch.baseVersionId) return true
  if (!currentVersionId) return true
  return patch.baseVersionId !== currentVersionId
}
