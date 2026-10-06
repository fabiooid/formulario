import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { EU_ANNEX_II_SOURCE_URL } from '@formulario/domain'
import { db } from './client.js'
import { products } from './schema.js'
import {
  ASEAN_ANNEX_PAGE_URL,
  ASEAN_ANNEX_PDF_URL,
  loadedEuVersion,
  prepareEuList,
  replaceEuBanRules,
  sha256,
} from './official-lists.js'
import { refreshDerived } from '../services/products.js'

const apiRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const aseanDir = path.join(apiRoot, 'data/official')
const aseanPdfPath = path.join(aseanDir, 'asean-annexes.pdf')
const aseanStatusPath = path.join(aseanDir, 'asean-annexes.json')

async function fetchBytes(url: string) {
  const response = await fetch(url, { signal: AbortSignal.timeout(60_000) })
  if (!response.ok) throw new Error(`${url} returned ${response.status}`)
  return Buffer.from(await response.arrayBuffer())
}

async function refreshEu() {
  const downloaded = (await fetchBytes(EU_ANNEX_II_SOURCE_URL)).toString('utf8')
  const list = prepareEuList(downloaded)
  if ((await loadedEuVersion()) === list.version) {
    console.log(`EU Annex II unchanged (list updated ${list.listUpdatedOn}).`)
    return
  }

  const count = await replaceEuBanRules(list)
  const saved = await db.select({ id: products.id, userId: products.userId }).from(products)
  for (const product of saved) {
    await refreshDerived(product.id, product.userId)
  }
  console.log(
    `EU Annex II replaced (${count} bans, list updated ${list.listUpdatedOn}). Saved formulas were checked again.`,
  )
}

async function refreshAsean() {
  const pdf = await fetchBytes(ASEAN_ANNEX_PDF_URL)
  if (pdf.subarray(0, 5).toString('utf8') !== '%PDF-') {
    throw new Error('ASEAN download is not a PDF. The previous file was left in place.')
  }
  mkdirSync(aseanDir, { recursive: true })
  const digest = sha256(pdf)
  let previous = ''
  try {
    previous = sha256(readFileSync(aseanPdfPath))
  } catch {
    previous = ''
  }
  const changed = digest !== previous
  if (changed) {
    const nextPath = `${aseanPdfPath}.next`
    writeFileSync(nextPath, pdf)
    renameSync(nextPath, aseanPdfPath)
  }
  const status = {
    sourceUrl: ASEAN_ANNEX_PDF_URL,
    pageUrl: ASEAN_ANNEX_PAGE_URL,
    retrievedAt: new Date().toISOString(),
    sha256: digest,
    bytes: pdf.length,
    changed,
    applied: false,
    reason:
      'Official PDF saved. Ingredient bans are not read from it until this table layout has been checked. ASEAN stays not checked.',
  }
  writeFileSync(aseanStatusPath, `${JSON.stringify(status, null, 2)}\n`)
  console.log(
    changed
      ? `ASEAN annex PDF saved (${pdf.length} bytes). Bans were not applied.`
      : 'ASEAN annex PDF unchanged. Bans stay off.',
  )
}

async function main() {
  const failures: string[] = []
  try {
    await refreshEu()
  } catch (error) {
    failures.push(error instanceof Error ? error.message : 'EU list refresh failed')
    console.error(`EU list kept as-is. ${failures[0]}`)
  }
  try {
    await refreshAsean()
  } catch (error) {
    const message = error instanceof Error ? error.message : 'ASEAN fetch failed'
    failures.push(message)
    console.error(`ASEAN file kept as-is. ${message}`)
  }
  if (failures.length > 0) process.exitCode = 1
}

await main()
