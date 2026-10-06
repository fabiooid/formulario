import type { FormulaRow, Product, ProductClaim, RegulatoryCheckResult } from '../types.ts'
import type { ClaimHit } from '../claims/engine.ts'
import { generateInciList, hasWaterPhase } from '../types.ts'

export interface PifDocument {
  productId: string
  generatedAt: string
  sections: PifSection[]
  markdown: string
}

export interface PifSection {
  id: string
  title: string
  content: string
  isGap: boolean
}

export function generatePifDraft(input: {
  product: Pick<Product, 'id' | 'name' | 'type' | 'markets' | 'brief' | 'claims'>
  rows: FormulaRow[]
  checks: RegulatoryCheckResult[]
  claimHits?: ClaimHit[]
}): PifDocument {
  const { product, rows, checks, claimHits = [] } = input
  const inci = generateInciList(rows)
  const water = hasWaterPhase(rows)
  const generatedAt = new Date().toISOString()

  // Copy before sorting — `rows` belongs to the caller and must keep its table order.
  const composition = [...rows]
    .filter((row) => row.inci.trim())
    .sort((a, b) => b.percent - a.percent)
    .map((row) => `- **${row.inci}** — ${row.percent}% w/w (${row.function}, ${row.phase})`)
    .join('\n')

  const regulatoryAnnex = checks
    .map((check) => {
      const hitLines =
        check.hits.length === 0
          ? '_No name or CAS number from this formula was found on the loaded official list. That is not an approval._'
          : check.hits
              .map(
                (hit) =>
                  `- ${hit.inci}: ${hit.message} ([${hit.instrument}](${hit.citationUrl}))`,
              )
              .join('\n')
      return `### ${check.market} — ${check.status.toUpperCase()}\n${hitLines}`
    })
    .join('\n\n')

  const sections: PifSection[] = [
    {
      id: 'description',
      title: 'Product description',
      content: `${product.name} (${product.type}). ${product.brief}`,
      isGap: false,
    },
    {
      id: 'composition',
      title: 'Qualitative and quantitative composition',
      content: composition || '_No formula rows committed._',
      isGap: !composition,
    },
    {
      id: 'manufacturing',
      title: 'Manufacturing',
      content: '_Placeholder — attach your batch record and GMP site details._',
      isGap: true,
    },
    {
      id: 'labelling',
      title: 'Labelling / INCI',
      content: inci || '_INCI will appear once the formula is committed._',
      isGap: !inci,
    },
    {
      id: 'claims',
      title: 'Claims',
      content: formatClaimsSection(product.claims ?? [], claimHits),
      // A claim still needs supplier evidence in the file, so it stays a gap; no claims, no gap.
      isGap: (product.claims ?? []).length > 0,
    },
    {
      id: 'stability',
      title: 'Stability',
      content: water
        ? '_Gap — add stability protocol and challenge test results (water phase present)._'
        : '_Gap — add stability protocol for oil/anhydrous matrix._',
      isGap: true,
    },
    {
      id: 'cpsr',
      title: 'CPSR / safety assessment',
      content:
        '_Gap — attach CPSR from your qualified safety assessor. This draft does not replace human assessment or market placement._',
      isGap: true,
    },
    {
      id: 'regulatory',
      title: 'Banned ingredients (official list)',
      content: regulatoryAnnex,
      isGap: false,
    },
  ]

  const markdown = sections
    .map((section) => `## ${section.title}\n\n${section.content}`)
    .join('\n\n---\n\n')

  return {
    productId: product.id,
    generatedAt,
    sections,
    markdown,
  }
}

const CLAIM_LABELS: Record<ProductClaim, string> = {
  vegan: 'Vegan',
  natural: 'Natural',
  organic: 'Organic',
}

function formatClaimsSection(claims: ProductClaim[], hits: ClaimHit[]): string {
  if (claims.length === 0) {
    return '_No intended claims selected. Pick vegan, natural, or organic on the product if you want formula checks._'
  }

  const labels = claims.map((claim) => CLAIM_LABELS[claim]).join(', ')
  const intro = `Intended claims: ${labels}. This is formulation intent, not a certificate.`
  if (hits.length === 0) {
    return `${intro}\n\nNo inventory conflicts on the committed formula. Attach supplier statements if you will print these claims.`
  }

  const lines = hits.map((hit) => `- **${hit.inci}** — ${claimHitLine(hit)}`)
  return `${intro}\n\nGaps against inventory flags:\n${lines.join('\n')}`
}

function claimHitLine(hit: ClaimHit): string {
  switch (hit.reason) {
    case 'animal_derived':
      return 'animal-derived, not vegan'
    case 'synthetic':
      return 'synthetic, not a natural match'
    case 'not_organic':
      return 'not marked organic'
    case 'unknown_animal':
      return 'vegan status unknown'
    case 'unknown_origin':
      return 'origin unknown, cannot confirm natural'
    case 'unknown_organic':
      return 'organic status unknown'
  }
}
