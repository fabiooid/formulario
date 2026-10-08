import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@libsql/client'

// Prints the Lab Assistant's live scores from mastra.db. Studio is off in production,
// so this is how to read them: `railway ssh`, then `npm run scores:report -- --days 7`.

const LOWER_IS_BETTER = new Set(['hallucination-scorer'])
const FLAG_BELOW = 0.5
const FLAG_ABOVE = 0.3

const apiRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const daysFlag = process.argv.indexOf('--days')
const days = daysFlag === -1 ? 7 : Number(process.argv[daysFlag + 1])
if (!Number.isFinite(days) || days <= 0) {
  console.error('Usage: npm run scores:report -- [--days 7]')
  process.exit(1)
}
const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
const db = createClient({ url: `file:${path.join(apiRoot, 'data/mastra.db')}` })

function flagged(scorerId: string, score: number) {
  return LOWER_IS_BETTER.has(scorerId) ? score > FLAG_ABOVE : score < FLAG_BELOW
}

function userText(input: unknown) {
  try {
    const parsed = typeof input === 'string' ? JSON.parse(input) : input
    const messages = (parsed?.inputMessages ?? []) as Array<{ content?: { content?: string; parts?: Array<{ text?: string }> } }>
    const last = messages.at(-1)?.content
    const text = last?.content ?? last?.parts?.map((part) => part.text ?? '').join(' ') ?? ''
    return text.replace(/\s+/g, ' ').slice(0, 120)
  } catch {
    return ''
  }
}

const rows = (
  await db.execute({
    sql: `select scorerId, score, reason, json(input) as input, threadId, createdAt
          from mastra_scorers where createdAt >= ? order by createdAt desc`,
    args: [since],
  })
).rows.map((row) => ({
  scorerId: String(row.scorerId),
  score: Number(row.score),
  reason: String(row.reason ?? ''),
  input: row.input,
  threadId: String(row.threadId ?? ''),
  createdAt: String(row.createdAt),
}))

console.log(`Lab Assistant scores, last ${days} day(s): ${rows.length} result(s)\n`)
if (rows.length === 0) process.exit(0)

const byScorer = new Map<string, typeof rows>()
for (const row of rows) byScorer.set(row.scorerId, [...(byScorer.get(row.scorerId) ?? []), row])

console.table(
  [...byScorer].map(([scorerId, list]) => ({
    scorer: scorerId,
    direction: LOWER_IS_BETTER.has(scorerId) ? 'lower is better' : 'higher is better',
    runs: list.length,
    average: Number((list.reduce((sum, row) => sum + row.score, 0) / list.length).toFixed(2)),
    flagged: list.filter((row) => flagged(scorerId, row.score)).length,
  })),
)

const worst = rows.filter((row) => flagged(row.scorerId, row.score)).slice(0, 15)
if (worst.length > 0) {
  console.log('\nLatest flagged replies:\n')
  for (const row of worst) {
    console.log(`${row.createdAt}  ${row.scorerId} = ${row.score.toFixed(2)}  thread ${row.threadId}`)
    console.log(`  asked:  ${userText(row.input)}`)
    console.log(`  reason: ${row.reason.replace(/\s+/g, ' ').slice(0, 240)}\n`)
  }
}
db.close()
