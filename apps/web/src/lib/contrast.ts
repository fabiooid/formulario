/** Lightweight WCAG relative-luminance helpers for design-token checks. */

export type Oklch = { l: number; c: number; h: number; a?: number }

export function parseOklch(value: string): Oklch | null {
  const match = value
    .trim()
    .match(
      /^oklch\(\s*([0-9.]+)\s+([0-9.]+)\s+([0-9.]+)(?:\s*\/\s*([0-9.]+)%?)?\s*\)$/i,
    )
  if (!match) return null
  const aRaw = match[4]
  let a: number | undefined
  if (aRaw != null) {
    a = Number(aRaw)
    if (value.includes('%') && a > 1) a = a / 100
  }
  return { l: Number(match[1]), c: Number(match[2]), h: Number(match[3]), a }
}

function oklchToLinearSrgb({ l, c, h }: Oklch): [number, number, number] {
  const hr = (h * Math.PI) / 180
  const a = c * Math.cos(hr)
  const b = c * Math.sin(hr)

  const l_ = l + 0.3963377774 * a + 0.2158037573 * b
  const m_ = l - 0.1055613458 * a - 0.0638541728 * b
  const s_ = l - 0.0894841775 * a - 1.291485548 * b

  const l3 = l_ ** 3
  const m3 = m_ ** 3
  const s3 = s_ ** 3

  return [
    4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3,
    -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3,
    -0.0041960863 * l3 - 0.7034186147 * m3 + 1.707614701 * s3,
  ]
}

/** Relative luminance for opaque OKLCH (alpha ignored; composite separately). */
export function relativeLuminance(color: Oklch): number {
  // OKLCH → linear sRGB already; clamp only (do not apply sRGB gamma again).
  const [r, g, b] = oklchToLinearSrgb(color).map((c) => Math.min(Math.max(c, 0), 1)) as [
    number,
    number,
    number,
  ]
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export function contrastRatio(fg: Oklch, bg: Oklch): number {
  const L1 = relativeLuminance(fg)
  const L2 = relativeLuminance(bg)
  const lighter = Math.max(L1, L2)
  const darker = Math.min(L1, L2)
  return (lighter + 0.05) / (darker + 0.05)
}

/** Source-over composite of fg (with alpha) onto opaque bg. */
export function compositeOver(fg: Oklch, bg: Oklch): Oklch {
  const a = fg.a ?? 1
  if (a >= 1) return { l: fg.l, c: fg.c, h: fg.h }
  // Approximate in OKLCH L/C only for soft fills; good enough for tinted badges.
  return {
    l: fg.l * a + bg.l * (1 - a),
    c: fg.c * a + bg.c * (1 - a),
    h: a >= 0.5 ? fg.h : bg.h,
  }
}

export function extractThemeBlock(css: string, selector: ':root' | '.dark'): Record<string, string> {
  const re =
    selector === ':root'
      ? /:root\s*\{([^}]+)\}/
      : /\.dark\s*\{([^}]+)\}/
  const block = css.match(re)?.[1]
  if (!block) return {}
  const vars: Record<string, string> = {}
  for (const line of block.split(';')) {
    const m = line.match(/--([\w-]+)\s*:\s*([^;]+)/)
    if (m) vars[m[1]] = m[2].trim()
  }
  return vars
}
