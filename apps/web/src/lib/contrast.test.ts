import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  compositeOver,
  contrastRatio,
  extractThemeBlock,
  parseOklch,
  type Oklch,
} from './contrast'

const css = readFileSync(resolve(__dirname, '../index.css'), 'utf8')

function requireOklch(value: string, label: string): Oklch {
  const parsed = parseOklch(value)
  if (!parsed) throw new Error(`Could not parse ${label}: ${value}`)
  return parsed
}

function themeTokens(selector: ':root' | '.dark') {
  const vars = extractThemeBlock(css, selector)
  const get = (name: string) => requireOklch(vars[name], `${selector} --${name}`)
  return {
    background: get('background'),
    foreground: get('foreground'),
    card: get('card'),
    muted: get('muted'),
    mutedForeground: get('muted-foreground'),
    destructive: get('destructive'),
    warning: get('warning'),
    ring: get('ring'),
    primary: get('primary'),
    primaryForeground: get('primary-foreground'),
  }
}

describe('design token contrast (WCAG 2.2 AA)', () => {
  for (const mode of [':root', '.dark'] as const) {
    const label = mode === ':root' ? 'light' : 'dark'

    it(`${label}: body and muted text meet 4.5:1`, () => {
      const t = themeTokens(mode)
      expect(contrastRatio(t.foreground, t.background)).toBeGreaterThanOrEqual(4.5)
      expect(contrastRatio(t.mutedForeground, t.background)).toBeGreaterThanOrEqual(4.5)
      expect(contrastRatio(t.mutedForeground, t.card)).toBeGreaterThanOrEqual(4.5)
      expect(contrastRatio(t.mutedForeground, t.muted)).toBeGreaterThanOrEqual(4.5)
    })

    it(`${label}: warning and destructive text meet 4.5:1 on card`, () => {
      const t = themeTokens(mode)
      expect(contrastRatio(t.warning, t.card)).toBeGreaterThanOrEqual(4.5)
      expect(contrastRatio(t.destructive, t.card)).toBeGreaterThanOrEqual(4.5)
      const badgeFill = compositeOver({ ...t.destructive, a: 0.1 }, t.card)
      expect(contrastRatio(t.destructive, badgeFill)).toBeGreaterThanOrEqual(4.5)
    })

    it(`${label}: focus ring meets 3:1 vs background`, () => {
      const t = themeTokens(mode)
      expect(contrastRatio(t.ring, t.background)).toBeGreaterThanOrEqual(3)
      expect(t.ring.a == null || t.ring.a >= 1).toBe(true)
    })

    it(`${label}: primary button text meets 4.5:1`, () => {
      const t = themeTokens(mode)
      expect(contrastRatio(t.primaryForeground, t.primary)).toBeGreaterThanOrEqual(4.5)
    })
  }
})
