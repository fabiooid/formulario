import { readFileSync } from 'node:fs'
import { and, eq } from 'drizzle-orm'
import { db } from './client.js'
import {
  chatThreads,
  formulaRows,
  formulaVersions,
  productVariants,
  products,
  users,
} from './schema.js'
import { hashPassword } from '../lib/auth.js'
import { ensurePersonalOrganization } from '../services/organizations.js'
import { listDateFromVersion, loadedEuVersion, prepareEuList, replaceEuBanRules } from './official-lists.js'
import { refreshDerived, setFinalVersion } from '../services/products.js'
import { seedDemoIngredients } from '../services/ingredients.js'

function now() {
  return new Date().toISOString()
}

function officialBanRules() {
  const csv = readFileSync(new URL('../../../../packages/domain/data/eu-annex-ii.csv', import.meta.url), 'utf8')
  return prepareEuList(csv)
}

// Loads the bundled official EU list, unless the daily refresh already loaded a newer one.
async function seedRules() {
  const list = officialBanRules()
  const loaded = await loadedEuVersion()
  const loadedDate = listDateFromVersion(loaded)
  if (loaded === list.version || (loadedDate && loadedDate > list.listUpdatedOn)) {
    console.log(`EU Annex II already loaded (${loaded}). Bundled copy not applied.`)
    return false
  }
  const count = await replaceEuBanRules(list)
  console.log(
    `Loaded ${count} EU Annex II bans from CosIng (list updated ${list.listUpdatedOn}, ${list.entryCount} entries in the file).`,
  )
  return true
}

async function refreshSavedChecks() {
  const saved = await db.select({ id: products.id, userId: products.userId }).from(products)
  for (const product of saved) {
    await refreshDerived(product.id, product.userId)
  }
}

async function seedDemoUser() {
  const userId = 'demo-user-id'
  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.id, userId)).limit(1)
  if (existing) return { userId, existed: true }
  await db.insert(users).values({
    id: userId,
    email: 'demo@local.test',
    passwordHash: await hashPassword('demo'),
    plan: 'free',
    createdAt: now(),
  })
  return { userId, existed: false }
}

/** Demo perfume should show Regulatory findings on first look (final version set). */
async function ensureDemoPerfumeFinal(userId: string) {
  const productId = 'prod-perfume'
  const [product] = await db.select({ id: products.id }).from(products).where(eq(products.id, productId)).limit(1)
  if (!product) return

  const [alreadyFinal] = await db
    .select({ id: formulaVersions.id })
    .from(formulaVersions)
    .where(and(eq(formulaVersions.productId, productId), eq(formulaVersions.isFinal, true)))
    .limit(1)
  if (alreadyFinal) return

  const [selected] = await db
    .select({ id: productVariants.id })
    .from(productVariants)
    .where(and(eq(productVariants.productId, productId), eq(productVariants.isSelectedFinal, true)))
    .limit(1)
  const variantId = selected?.id
  const [version] = variantId
    ? await db
        .select({ id: formulaVersions.id })
        .from(formulaVersions)
        .where(and(eq(formulaVersions.variantId, variantId), eq(formulaVersions.isCurrent, true)))
        .limit(1)
    : await db
        .select({ id: formulaVersions.id })
        .from(formulaVersions)
        .where(eq(formulaVersions.productId, productId))
        .limit(1)
  if (!version) return

  await setFinalVersion(version.id, productId, userId)
  // Align leftover "Variant …" seed labels with versions-only wording when still present.
  const variants = await db.select().from(productVariants).where(eq(productVariants.productId, productId))
  for (const variant of variants) {
    const nextLabel = variant.label
      .replace(/^Variant\s+\d+\s*[—–-]\s*/i, '')
      .trim()
    if (nextLabel && nextLabel !== variant.label) {
      await db.update(productVariants).set({ label: nextLabel }).where(eq(productVariants.id, variant.id))
      await db
        .update(formulaVersions)
        .set({ label: nextLabel })
        .where(eq(formulaVersions.variantId, variant.id))
    }
  }
}

async function seedProductWithVariants(
  userId: string,
  organizationId: string,
  input: {
    id: string
    name: string
    type: 'skincare' | 'perfume' | 'hybrid'
    brief: string
    claims?: Array<'vegan' | 'natural' | 'organic'>
    variants: Array<{
      label: string
      /** Shown in the versions-only UI; falls back to label. */
      versionLabel?: string
      isSelectedFinal?: boolean
      macerationStartedAt?: string
      macerationTargetAt?: string
      macerationNotes?: string
      rows: Array<{
        inci: string
        function: string
        phase: string
        percent: number
        notes?: string
      }>
    }>
  },
) {
  const created = now()
  await db.insert(products).values({
    id: input.id,
    userId,
    organizationId,
    name: input.name,
    type: input.type,
    markets: JSON.stringify(['EU', 'ASEAN']),
    brief: input.brief,
    claims: JSON.stringify(input.claims ?? []),
    status: 'draft',
    createdAt: created,
    updatedAt: created,
  })

  let finalVersionId: string | null = null

  for (const [index, variantInput] of input.variants.entries()) {
    const variantId = crypto.randomUUID()
    const versionId = crypto.randomUUID()
    const versionLabel = variantInput.versionLabel ?? variantInput.label

    await db.insert(productVariants).values({
      id: variantId,
      productId: input.id,
      label: variantInput.label,
      sortOrder: index,
      isSelectedFinal: false,
      createdAt: created,
    })

    await db.insert(formulaVersions).values({
      id: versionId,
      productId: input.id,
      variantId,
      versionNumber: 1,
      label: versionLabel,
      isCurrent: true,
      macerationStartedAt: variantInput.macerationStartedAt ?? null,
      macerationTargetAt: variantInput.macerationTargetAt ?? null,
      macerationNotes: variantInput.macerationNotes ?? null,
      createdAt: created,
    })

    await db.insert(formulaRows).values(
      variantInput.rows.map((row, rowIndex) => ({
        id: crypto.randomUUID(),
        versionId,
        inci: row.inci,
        function: row.function,
        phase: row.phase,
        percent: row.percent,
        notes: row.notes,
        sortOrder: rowIndex,
      })),
    )

    if (variantInput.isSelectedFinal) finalVersionId = versionId
  }

  await db.insert(chatThreads).values({
    id: crypto.randomUUID(),
    productId: input.id,
    mastraThreadId: `thread-${input.id}`,
    createdAt: created,
  })

  if (finalVersionId) {
    await setFinalVersion(finalVersionId, input.id, userId)
  } else {
    await refreshDerived(input.id, userId)
  }
}

async function main() {
  console.log('Loading the official EU banned list...')
  const rulesChanged = await seedRules()
  // Production runs this on every boot: official list only, never the demo account.
  if (process.argv.includes('--official-only')) {
    if (rulesChanged) await refreshSavedChecks()
    return
  }
  const { userId, existed } = await seedDemoUser()
  if (existed) {
    // Older seeds set the selected-final variant without marking a formula version final.
    await ensureDemoPerfumeFinal(userId)
    await refreshSavedChecks()
    console.log('Demo user already exists — official bans reloaded and saved checks refreshed.')
    return
  }
  const personal = await ensurePersonalOrganization(userId)
  await seedDemoIngredients(personal.id)

  await seedProductWithVariants(userId, personal.id, {
    id: 'prod-face-oil',
    name: 'Dry Unscented Face Oil',
    type: 'skincare',
    brief: 'Light unscented face oil that feels dry on skin. No essential oils. EU home market.',
    claims: ['vegan', 'natural'],
    variants: [
      {
        label: 'Main',
        rows: [
          { inci: 'Squalane', function: 'Emollient', phase: 'Oil', percent: 70 },
          { inci: 'Caprylic/Capric Triglyceride', function: 'Emollient', phase: 'Oil', percent: 25 },
          { inci: 'MadeUpine', function: 'Active', phase: 'Oil', percent: 5, notes: 'Unknown INCI for demo' },
        ],
      },
    ],
  })

  await seedProductWithVariants(userId, personal.id, {
    id: 'prod-cream',
    name: 'Daily Barrier Cream',
    type: 'skincare',
    brief: 'Water-based cream with barrier lipids. Needs preservative.',
    variants: [
      {
        label: 'Main',
        rows: [
          { inci: 'Aqua', function: 'Solvent', phase: 'Water', percent: 68.5 },
          { inci: 'Glycerin', function: 'Humectant', phase: 'Water', percent: 5 },
          { inci: 'Cetearyl Alcohol', function: 'Emulsifier', phase: 'Water', percent: 4 },
          { inci: 'Shea Butter', function: 'Emollient', phase: 'Oil', percent: 10 },
          { inci: 'Squalane', function: 'Emollient', phase: 'Oil', percent: 10 },
          { inci: 'Phenoxyethanol', function: 'Preservative', phase: 'Water', percent: 1.5 },
          { inci: 'Tocopherol', function: 'Antioxidant', phase: 'Oil', percent: 1 },
        ],
      },
    ],
  })

  const macerationStart = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const macerationTarget = new Date(Date.now() + 21 * 24 * 60 * 60 * 1000).toISOString()

  await seedProductWithVariants(userId, personal.id, {
    id: 'prod-perfume',
    name: 'No. 3 Oil Perfume',
    type: 'perfume',
    brief: 'Oil-based perfume. Includes an ingredient named on the EU banned list.',
    variants: [
      {
        label: 'Softer',
        versionLabel: 'Softer',
        macerationStartedAt: macerationStart,
        macerationTargetAt: macerationTarget,
        macerationNotes: 'Testing lower coumarin.',
        rows: [
          { inci: 'Fragrance', function: 'Fragrance', phase: 'Fragrance', percent: 16 },
          { inci: 'Linalool', function: 'Fragrance allergen', phase: 'Fragrance', percent: 0.06 },
          { inci: 'Coumarin', function: 'Fragrance material', phase: 'Fragrance', percent: 0.2 },
          { inci: 'Butylphenyl Methylpropional', function: 'Fragrance material', phase: 'Fragrance', percent: 0.02 },
          { inci: 'Caprylic/Capric Triglyceride', function: 'Carrier', phase: 'Oil', percent: 83.72 },
        ],
      },
      {
        label: 'Original',
        versionLabel: 'Original',
        isSelectedFinal: true,
        rows: [
          { inci: 'Fragrance', function: 'Fragrance', phase: 'Fragrance', percent: 18 },
          { inci: 'Linalool', function: 'Fragrance allergen', phase: 'Fragrance', percent: 0.08 },
          { inci: 'Coumarin', function: 'Fragrance material', phase: 'Fragrance', percent: 0.3 },
          { inci: 'Butylphenyl Methylpropional', function: 'Fragrance material', phase: 'Fragrance', percent: 0.02 },
          { inci: 'Caprylic/Capric Triglyceride', function: 'Carrier', phase: 'Oil', percent: 81.6 },
        ],
      },
      {
        label: 'Brighter top',
        versionLabel: 'Brighter top',
        rows: [
          { inci: 'Fragrance', function: 'Fragrance', phase: 'Fragrance', percent: 17 },
          { inci: 'Linalool', function: 'Fragrance allergen', phase: 'Fragrance', percent: 0.12 },
          { inci: 'Coumarin', function: 'Fragrance material', phase: 'Fragrance', percent: 0.15 },
          { inci: 'Butylphenyl Methylpropional', function: 'Fragrance material', phase: 'Fragrance', percent: 0.01 },
          { inci: 'Caprylic/Capric Triglyceride', function: 'Carrier', phase: 'Oil', percent: 82.72 },
        ],
      },
    ],
  })

  console.log('Seed complete. Demo login: demo@local.test / demo')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
