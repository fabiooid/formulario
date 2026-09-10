/**
 * Live eval: run the fixed briefs through the Lab Assistant and score what lands on the card.
 *
 *   npm run eval:briefs --workspace=apps/api            # all briefs
 *   npm run eval:briefs --workspace=apps/api -- ha-serum citrus-edp
 *   KEEP=1 npm run eval:briefs --workspace=apps/api     # leave the proposals pending in the app
 *   VERBOSE=1 npm run eval:briefs --workspace=apps/api  # print every tool call and rejection report
 *   PAUSE_MS=0 …                                          # no pause between briefs (default 20 s, for token-per-minute limits)
 *
 * Needs a model key in .env and a seeded database (npm run db:setup). Proposals the agent
 * makes are rejected at the end so the demo workspace stays clean, unless KEEP=1.
 */
import { RequestContext } from '@mastra/core/request-context'
import {
  EVAL_BRIEFS,
  checkFormulaDraft,
  findMaterial,
  inferFormat,
  normalizeInci,
  type FormulaDraftRow,
} from '@atelier/domain'
import { mastra } from '../src/mastra/index.js'
import { listIngredients } from '../src/services/ingredients.js'
import { loadRules } from '../src/services/products.js'
import { listPendingProposals, resolveProposal } from '../src/services/proposals.js'

const USER_ID = 'demo-user-id'
const keep = process.env.KEEP === '1'
const verbose = process.env.VERBOSE === '1'
/** Pause between briefs so a small tokens-per-minute limit does not fail the run. */
const pauseMs = Number(process.env.PAUSE_MS ?? 20000)
const only = process.argv.slice(2).filter((arg) => !arg.startsWith('-'))

type Score = {
  id: string
  proposed: boolean
  rows: number
  blocks: number
  warns: number
  rejectedTries: number
  expectedHit: string
  formatOk: boolean
  seconds: number
  note?: string
}

function hasMaterial(rows: FormulaDraftRow[], wanted: string) {
  const target = findMaterial(wanted)
  const keys = new Set([normalizeInci(wanted), ...(target ? [target.inci, ...(target.aliases ?? [])].map(normalizeInci) : [])])
  return rows.some((row) => {
    const material = findMaterial(row.inci)
    const rowKeys = new Set([normalizeInci(row.inci), ...(material ? [material.inci, ...(material.aliases ?? [])].map(normalizeInci) : [])])
    return [...keys].some((key) => rowKeys.has(key))
  })
}

async function main() {
  const agent = mastra.getAgent('formulatorAgent')
  const [rules, shelf] = await Promise.all([loadRules(), listIngredients(USER_ID)])
  const briefs = only.length ? EVAL_BRIEFS.filter((brief) => only.includes(brief.id)) : EVAL_BRIEFS
  const scores: Score[] = []

  for (const [index, brief] of briefs.entries()) {
    if (index > 0 && pauseMs > 0) await new Promise((resolve) => setTimeout(resolve, pauseMs))
    const started = Date.now()
    const before = new Set((await listPendingProposals(USER_ID)).map((item) => item.id))
    const requestContext = new RequestContext()
    requestContext.set('userId', USER_ID)

    const claims = brief.claims?.length ? ` Claims: ${brief.claims.join(', ')}.` : ''
    const prompt = `Draft a new ${brief.type} product called "${brief.name}". Brief: ${brief.brief}${claims} Propose it with the full formula.`

    let rejectedTries = 0
    let note: string | undefined
    try {
      const result = await agent.generate(prompt, {
        requestContext,
        maxSteps: 14,
        memory: { resource: USER_ID, thread: `eval-${brief.id}-${Date.now()}` },
      })
      type ToolResultLike = { payload?: { toolName?: string; result?: unknown } }
      const steps = (result as { steps?: Array<{ toolResults?: ToolResultLike[] }> }).steps ?? []
      const toolResults = steps.flatMap((step) => step.toolResults ?? [])
      for (const item of toolResults) {
        const value = item.payload?.result as { error?: string; report?: string; rows?: number } | undefined
        const rejected = typeof value?.error === 'string' && value.error.startsWith('Draft rejected')
        if (rejected) rejectedTries += 1
        if (verbose) {
          const tag = rejected ? 'REJECTED' : value?.error ? `error: ${value.error.slice(0, 80)}` : value?.rows != null ? `ok, ${value.rows} rows` : 'ok'
          console.log(`     > ${item.payload?.toolName ?? '?'} — ${tag}`)
          if (rejected && value?.report) console.log(value.report.split('\n').map((line) => `         ${line}`).join('\n'))
        }
      }
      note = (result.text ?? '').replace(/\s+/g, ' ').trim().slice(0, 140)
    } catch (error) {
      note = `agent error: ${(error as Error).message}`
    }

    const created = (await listPendingProposals(USER_ID)).filter((item) => !before.has(item.id))
    const product = created.find((item) => item.kind === 'product_create')
    const payload = product?.payload as { formula?: FormulaDraftRow[]; type?: typeof brief.type; brief?: string; name?: string } | undefined
    const rows = payload?.formula ?? []

    const guess = inferFormat({ brief: brief.brief, name: brief.name, productType: brief.type })
    const report = rows.length
      ? checkFormulaDraft({
          rows,
          format: brief.expectFormat,
          productType: brief.type,
          markets: ['EU'],
          claims: brief.claims,
          rules,
          inventory: shelf,
        })
      : null

    const expected = brief.expectMaterials ?? []
    const hits = expected.filter((wanted) => hasMaterial(rows, wanted)).length

    scores.push({
      id: brief.id,
      proposed: Boolean(product),
      rows: rows.length,
      blocks: report ? report.issues.filter((issue) => issue.severity === 'block').length : 0,
      warns: report ? report.issues.filter((issue) => issue.severity === 'warn').length : 0,
      rejectedTries,
      expectedHit: expected.length ? `${hits}/${expected.length}` : '-',
      formatOk: guess.format === brief.expectFormat,
      seconds: Math.round((Date.now() - started) / 1000),
      note,
    })

    if (!keep) {
      for (const item of created) await resolveProposal(USER_ID, item.id, 'rejected')
    }

    const last = scores[scores.length - 1]
    console.log(
      `${last.proposed ? 'ok ' : 'MISS'} ${brief.id.padEnd(20)} rows ${String(last.rows).padStart(2)}  blocks ${last.blocks}  warns ${String(last.warns).padStart(2)}  retries ${last.rejectedTries}  expected ${last.expectedHit.padEnd(4)} ${last.seconds}s`,
    )
    if (report) {
      for (const issue of report.issues) console.log(`     ${issue.severity === 'block' ? '!!' : ' -'} ${issue.message}`)
    }
    if (verbose && rows.length) {
      for (const row of rows) console.log(`       ${row.phase.padEnd(3)} ${String(row.percent).padStart(6)}  ${row.inci}  (${row.function})`)
    }
    if (last.note) console.log(`     "${last.note}"`)
  }

  const proposed = scores.filter((score) => score.proposed).length
  const clean = scores.filter((score) => score.proposed && score.blocks === 0).length
  const avgRows = proposed ? Math.round(scores.filter((s) => s.proposed).reduce((sum, s) => sum + s.rows, 0) / proposed) : 0
  console.log('')
  console.log(`Proposed ${proposed}/${scores.length}. Passed the gate ${clean}/${scores.length}. Average rows ${avgRows}. Retries ${scores.reduce((sum, s) => sum + s.rejectedTries, 0)}.`)
  if (!keep) console.log('Proposals were rejected to keep the demo workspace clean. Set KEEP=1 to leave them pending.')
  process.exit(0)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
