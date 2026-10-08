import { desc, eq, gte } from 'drizzle-orm'
import { db, libsql } from './client.js'
import { feedback, users } from './schema.js'

// Prints what testers sent from the feedback form: `npm run feedback:report -- --days 7`.

const daysFlag = process.argv.indexOf('--days')
const days = daysFlag === -1 ? 7 : Number(process.argv[daysFlag + 1])
if (!Number.isFinite(days) || days <= 0) {
  console.error('Usage: npm run feedback:report -- [--days 7]')
  process.exit(1)
}
const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

const rows = await db
  .select({ createdAt: feedback.createdAt, email: users.email, message: feedback.message })
  .from(feedback)
  .leftJoin(users, eq(users.id, feedback.userId))
  .where(gte(feedback.createdAt, since))
  .orderBy(desc(feedback.createdAt))

console.log(`Feedback, last ${days} day(s): ${rows.length} message(s)\n`)
for (const row of rows) {
  console.log(`${row.createdAt}  ${row.email ?? '(deleted account)'}`)
  console.log(`  ${row.message.replace(/\n/g, '\n  ')}\n`)
}
libsql.close()
