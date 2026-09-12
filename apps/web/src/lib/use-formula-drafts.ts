import { useState } from 'react'
import { FormulaRowSchema } from '@atelier/domain'
import { finishFormulaSave, type FormulaDraft, type FormulaDrafts } from './formula-drafts'

function readDrafts(key: string): FormulaDrafts {
  try {
    const stored: unknown = JSON.parse(sessionStorage.getItem(key) ?? '{}')
    if (!stored || typeof stored !== 'object') return {}
    return Object.fromEntries(
      Object.entries(stored).filter(
        ([, draft]) =>
          draft &&
          (draft.baseVersionId === null || typeof draft.baseVersionId === 'string') &&
          FormulaRowSchema.array().safeParse(draft.rows).success,
      ),
    )
  } catch {
    return {}
  }
}

// The page is keyed by user, organisation and product, so a new context gets its
// own state. Session storage preserves edits across navigation and tab reloads.
export function useFormulaDrafts(key: string) {
  const [drafts, setDrafts] = useState<FormulaDrafts>(() => readDrafts(key))
  function update(change: (current: FormulaDrafts) => FormulaDrafts) {
    setDrafts((current) => {
      const next = change(current)
      try {
        sessionStorage.setItem(key, JSON.stringify(next))
      } catch {
        /* Keep in-memory edits if storage is unavailable. */
      }
      return next
    })
  }
  return {
    drafts,
    edit: (variantId: string, draft: FormulaDraft) =>
      update((current) => ({ ...current, [variantId]: draft })),
    discard: (variantId: string) =>
      update((current) => {
        const next = { ...current }
        delete next[variantId]
        return next
      }),
    saved: (variantId: string, submitted: FormulaDraft, versionId: string) =>
      update((current) => finishFormulaSave(current, variantId, submitted, versionId)),
  }
}
