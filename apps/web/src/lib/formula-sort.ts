import type { FormulaRow } from './api'

export type FormulaPercentSort = 'saved' | 'percent-desc' | 'percent-asc'

const STORAGE_PREFIX = 'formulario.formula-percent-sort:'

const MODES: FormulaPercentSort[] = ['saved', 'percent-desc', 'percent-asc']

export function isFormulaPercentSort(value: unknown): value is FormulaPercentSort {
  return value === 'saved' || value === 'percent-desc' || value === 'percent-asc'
}

export function cycleFormulaPercentSort(mode: FormulaPercentSort): FormulaPercentSort {
  const index = MODES.indexOf(mode)
  return MODES[(index + 1) % MODES.length]!
}

/** View-only reorder by %. Equal percents keep saved order (stable). */
export function applyFormulaPercentSort(
  rows: FormulaRow[],
  mode: FormulaPercentSort,
): FormulaRow[] {
  if (mode === 'saved') return rows

  const indexed = rows.map((row, index) => ({ row, index }))
  indexed.sort((a, b) => {
    const diff =
      mode === 'percent-desc'
        ? b.row.percent - a.row.percent
        : a.row.percent - b.row.percent
    if (diff !== 0) return diff
    const orderDiff = a.row.sortOrder - b.row.sortOrder
    if (orderDiff !== 0) return orderDiff
    return a.index - b.index
  })
  return indexed.map((entry) => entry.row)
}

/** Persist display sort per product in localStorage only (never server). */
export function readFormulaPercentSort(productId: string): FormulaPercentSort {
  if (typeof localStorage === 'undefined' || !productId) return 'saved'
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${productId}`)
    return isFormulaPercentSort(raw) ? raw : 'saved'
  } catch {
    return 'saved'
  }
}

export function writeFormulaPercentSort(productId: string, mode: FormulaPercentSort): void {
  if (typeof localStorage === 'undefined' || !productId) return
  try {
    if (mode === 'saved') {
      localStorage.removeItem(`${STORAGE_PREFIX}${productId}`)
    } else {
      localStorage.setItem(`${STORAGE_PREFIX}${productId}`, mode)
    }
  } catch {
    // Ignore quota / private mode.
  }
}

/** Rewrite sortOrder to match the current display order (explicit Keep this order). */
export function rowsWithDisplayOrder(rows: FormulaRow[]): FormulaRow[] {
  return rows.map((row, index) => ({ ...row, sortOrder: index }))
}
