import type { FormulaRow } from './api'

export function formulaContentEquals(a: FormulaRow[], b: FormulaRow[]) {
  return JSON.stringify(a) === JSON.stringify(b)
}
