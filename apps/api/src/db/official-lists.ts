import { createHash } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { parseEuAnnexII, type EuAnnexIIList, type IngredientRule } from '@formulario/domain'
import { db } from './client.js'
import { ingredientRules } from './schema.js'
import { clearRulesCache } from '../services/products.js'

/** Singapore's stable copy of the current ASEAN annexes. The short link on the HSA page points here. */
export const ASEAN_ANNEX_PDF_URL = 'https://file.go.gov.sg/annexes-of-the-asean-cosmetic-directive.pdf'

export const ASEAN_ANNEX_PAGE_URL = 'https://www.hsa.gov.sg/cosmetic-products/asean-cosmetic-directive/'

export type PreparedEuList = EuAnnexIIList & { version: string }

export function sha256(value: string | Buffer) {
  return createHash('sha256').update(value).digest('hex')
}

/** The export restamps "File creation date" on every download, so that line is left out. */
export function euFingerprint(csv: string) {
  const body = csv
    .split('\n')
    .filter((line) => !line.includes('File creation date'))
    .join('\n')
  return sha256(body).slice(0, 12)
}

/**
 * Parse a Commission Annex II file and tag every rule with its list date and content fingerprint.
 * Throws if it is not the expected export, so a bad download never replaces the list in use.
 */
export function prepareEuList(csv: string): PreparedEuList {
  const list = parseEuAnnexII(csv)
  const version = `cosing-annex-ii-${list.listUpdatedOn}-${euFingerprint(csv)}`
  return { ...list, version, rules: list.rules.map((rule) => ({ ...rule, version })) }
}

export function listDateFromVersion(version: string | null) {
  return version?.match(/^cosing-annex-ii-(\d{4}-\d{2}-\d{2})/)?.[1] ?? null
}

export async function loadedEuVersion() {
  const [row] = await db
    .select({ version: ingredientRules.version })
    .from(ingredientRules)
    .where(eq(ingredientRules.market, 'EU'))
    .limit(1)
  return row?.version ?? null
}

function ruleRow(rule: IngredientRule) {
  return {
    id: rule.id,
    version: rule.version,
    market: rule.market,
    instrument: rule.instrument,
    substance: rule.substance,
    inciNames: JSON.stringify(rule.inciNames),
    casNumbers: rule.casNumbers ? JSON.stringify(rule.casNumbers) : null,
    maxPercent: rule.maxPercent ?? null,
    labelThresholdPercent: rule.labelThresholdPercent ?? null,
    effect: rule.effect,
    citationUrl: rule.citationUrl,
    message: rule.message,
    productTypes: rule.productTypes ? JSON.stringify(rule.productTypes) : null,
    leaveOnOnly: rule.leaveOnOnly ?? null,
    ifraCategory: rule.ifraCategory ?? null,
    preferredInci: rule.preferredInci ?? null,
  }
}

/** Swap the ban table inside one transaction. A failed load leaves the previous list in place. */
export async function replaceEuBanRules(list: PreparedEuList) {
  const rows = list.rules.map(ruleRow)
  await db.transaction(async (tx) => {
    await tx.delete(ingredientRules)
    const size = 40
    for (let index = 0; index < rows.length; index += size) {
      await tx.insert(ingredientRules).values(rows.slice(index, index + size))
    }
  })
  clearRulesCache()
  return rows.length
}
