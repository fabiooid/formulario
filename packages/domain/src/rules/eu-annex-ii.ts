import type { IngredientRule } from '../types.ts'

/** Official CosIng export of Annex II. Retrieved from the European Commission, not typed by hand. */
export const EU_ANNEX_II_SOURCE_URL =
  'https://api.tech.ec.europa.eu/cosing20/1.0/api/annexes/II/export-csv'

export const EU_ANNEX_II_CITATION_URL =
  'https://ec.europa.eu/growth/tools-databases/cosing/reference/annexes/list/II'

export type EuAnnexIIList = {
  sourceUrl: string
  citationUrl: string
  fileCreatedOn: string
  listUpdatedOn: string
  entryCount: number
  rules: IngredientRule[]
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let inQuotes = false

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]
    if (inQuotes) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          cell += '"'
          index += 1
        } else {
          inQuotes = false
        }
      } else {
        cell += char
      }
      continue
    }
    if (char === '"') {
      inQuotes = true
    } else if (char === ',') {
      row.push(cell)
      cell = ''
    } else if (char === '\n') {
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
    } else if (char !== '\r') {
      cell += char
    }
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell)
    rows.push(row)
  }
  return rows
}

function isoDate(value: string): string | null {
  const match = value.match(/(\d{2})\/(\d{2})\/(\d{4})/)
  if (!match) return null
  return `${match[3]}-${match[2]}-${match[1]}`
}

function clean(value: string | undefined) {
  return (value ?? '').replace(/\s+/g, ' ').trim()
}

/** A single substance name from the official row. Category sentences are not names. */
function singleSubstanceName(raw: string): string | null {
  const name = clean(raw).replace(/\s*\(INN\)\s*$/i, '').trim()
  if (name.length < 3 || name.length > 120) return null
  if (/[,:;]|\band\b/i.test(name)) return null
  return name
}

function identifiedNames(raw: string): string[] {
  const names = raw
    .split(',')
    .map((name) => clean(name))
    .filter((name) => name.length >= 2)
  return [...new Set(names)]
}

function casNumbers(raw: string): string[] {
  const numbers = raw
    .split(/[/,]/)
    .map((number) => clean(number))
    .filter((number) => number.length > 1 && number !== '-')
  return [...new Set(numbers)]
}

/**
 * Turn the Commission's Annex II CSV into ban rules.
 * A formula matches only a name or CAS number printed on that row.
 */
export function parseEuAnnexII(csv: string): EuAnnexIIList {
  const rows = parseCsv(csv)
  const fileCreatedOn = isoDate(rows.find((row) => row.join(' ').includes('File creation date'))?.join(' ') ?? '')
  const listUpdatedOn = isoDate(rows.find((row) => row.join(' ').includes('Last update'))?.join(' ') ?? '')
  if (!fileCreatedOn || !listUpdatedOn) {
    throw new Error('CosIng Annex II export is missing its file date or last update')
  }

  const headerIndex = rows.findIndex((row) => row[0] === 'Reference Number')
  if (headerIndex < 0) throw new Error('CosIng Annex II export is missing its column header')

  const version = `cosing-annex-ii-${listUpdatedOn}`
  const rules: IngredientRule[] = []
  const referenceCount = new Map<string, number>()
  let entryCount = 0

  for (const row of rows.slice(headerIndex + 1)) {
    const reference = clean(row[0])
    if (!/^\d+$/.test(reference)) continue
    entryCount += 1
    const occurrence = (referenceCount.get(reference) ?? 0) + 1
    referenceCount.set(reference, occurrence)

    const chemicalName = clean(row[1])
    const cas = casNumbers(row[2] ?? '')
    const names = identifiedNames(row[8] ?? '')
    const chemical = singleSubstanceName(chemicalName)
    if (chemical) names.push(chemical)

    const inciNames = [...new Set(names)]
    if (inciNames.length === 0 && cas.length === 0) continue

    const shownName = inciNames[0] ?? chemicalName
    rules.push({
      id: occurrence === 1 ? `eu-annex-ii-${reference}` : `eu-annex-ii-${reference}-${occurrence}`,
      version,
      market: 'EU',
      instrument: 'EU Annex II',
      substance: chemicalName.slice(0, 400) || shownName,
      inciNames,
      casNumbers: cas.length > 0 ? cas : undefined,
      effect: 'cannot_sell',
      citationUrl: EU_ANNEX_II_CITATION_URL,
      message: `${shownName} is on the EU list of substances prohibited in cosmetic products (Annex II, reference ${reference}). European Commission CosIng, list updated ${listUpdatedOn}.`,
    })
  }

  if (rules.length === 0) throw new Error('CosIng Annex II export produced no matchable bans')

  return {
    sourceUrl: EU_ANNEX_II_SOURCE_URL,
    citationUrl: EU_ANNEX_II_CITATION_URL,
    fileCreatedOn,
    listUpdatedOn,
    entryCount,
    rules,
  }
}
