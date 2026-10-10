import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { FormulaRow } from './api'
import {
  applyFormulaPercentSort,
  cycleFormulaPercentSort,
  isFormulaPercentSort,
  readFormulaPercentSort,
  rowsWithDisplayOrder,
  writeFormulaPercentSort,
} from './formula-sort'

const row = (overrides: Partial<FormulaRow> & { id: string }): FormulaRow => ({
  inci: 'Water',
  function: '',
  phase: 'A',
  percent: 0,
  sortOrder: 0,
  ...overrides,
})

describe('cycleFormulaPercentSort', () => {
  it('cycles highest → lowest → your order', () => {
    expect(cycleFormulaPercentSort('saved')).toBe('percent-desc')
    expect(cycleFormulaPercentSort('percent-desc')).toBe('percent-asc')
    expect(cycleFormulaPercentSort('percent-asc')).toBe('saved')
  })
})

describe('applyFormulaPercentSort', () => {
  const rows = [
    row({ id: 'a', inci: 'A', percent: 10, sortOrder: 0 }),
    row({ id: 'b', inci: 'B', percent: 70, sortOrder: 1 }),
    row({ id: 'c', inci: 'C', percent: 20, sortOrder: 2 }),
  ]

  it('keeps saved order by default', () => {
    expect(applyFormulaPercentSort(rows, 'saved').map((r) => r.id)).toEqual(['a', 'b', 'c'])
  })

  it('sorts highest percent first', () => {
    expect(applyFormulaPercentSort(rows, 'percent-desc').map((r) => r.id)).toEqual([
      'b',
      'c',
      'a',
    ])
  })

  it('sorts lowest percent first', () => {
    expect(applyFormulaPercentSort(rows, 'percent-asc').map((r) => r.id)).toEqual([
      'a',
      'c',
      'b',
    ])
  })

  it('keeps saved order when percents tie', () => {
    const tied = [
      row({ id: 'x', percent: 50, sortOrder: 0 }),
      row({ id: 'y', percent: 50, sortOrder: 1 }),
      row({ id: 'z', percent: 10, sortOrder: 2 }),
    ]
    expect(applyFormulaPercentSort(tied, 'percent-desc').map((r) => r.id)).toEqual([
      'x',
      'y',
      'z',
    ])
  })

  it('does not mutate the input array or rows', () => {
    const before = rows.map((r) => ({ ...r }))
    const sorted = applyFormulaPercentSort(rows, 'percent-desc')
    expect(rows.map((r) => r.id)).toEqual(['a', 'b', 'c'])
    expect(sorted).not.toBe(rows)
    expect(rows).toEqual(before)
  })
})

describe('rowsWithDisplayOrder', () => {
  it('writes sortOrder from current array positions', () => {
    const display = [
      row({ id: 'b', percent: 70, sortOrder: 1 }),
      row({ id: 'a', percent: 10, sortOrder: 0 }),
    ]
    expect(rowsWithDisplayOrder(display).map((r) => ({ id: r.id, sortOrder: r.sortOrder }))).toEqual(
      [
        { id: 'b', sortOrder: 0 },
        { id: 'a', sortOrder: 1 },
      ],
    )
  })
})

describe('formula percent sort storage', () => {
  const store = new Map<string, string>()

  beforeEach(() => {
    store.clear()
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value)
      },
      removeItem: (key: string) => {
        store.delete(key)
      },
      clear: () => store.clear(),
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('reads and writes per product, clearing when back to saved', () => {
    expect(readFormulaPercentSort('prod-1')).toBe('saved')
    writeFormulaPercentSort('prod-1', 'percent-desc')
    expect(readFormulaPercentSort('prod-1')).toBe('percent-desc')
    expect(readFormulaPercentSort('prod-2')).toBe('saved')
    writeFormulaPercentSort('prod-1', 'saved')
    expect(readFormulaPercentSort('prod-1')).toBe('saved')
    expect(store.has('formulario.formula-percent-sort:prod-1')).toBe(false)
  })

  it('ignores invalid stored values', () => {
    store.set('formulario.formula-percent-sort:prod-1', 'nope')
    expect(readFormulaPercentSort('prod-1')).toBe('saved')
    expect(isFormulaPercentSort('percent-asc')).toBe(true)
    expect(isFormulaPercentSort('nope')).toBe(false)
  })
})
