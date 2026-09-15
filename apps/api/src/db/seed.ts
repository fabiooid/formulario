import { SEED_RULES, RULES_VERSION } from '@formulario/domain'
import { eq } from 'drizzle-orm'
import { db } from './client.js'
import {
  chatThreads,
  formulaRows,
  formulaVersions,
  ingredientRules,
  productVariants,
  products,
  users,
} from './schema.js'
import { hashPassword } from '../lib/auth.js'
import { ensurePersonalOrganization } from '../services/organizations.js'
import { refreshDerived, setSelectedFinalVariant } from '../services/products.js'
import { seedDemoIngredients } from '../services/ingredients.js'

function now() {
  return new Date().toISOString()
}

// Re-running the seed refreshes the rules table in place, so rule text and links stay current.
async function seedRules() {
  for (const rule of SEED_RULES) {
    const update = {
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
    await db
      .insert(ingredientRules)
      .values({ id: rule.id, ...update })
      .onConflictDoUpdate({ target: ingredientRules.id, set: update })
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

  let finalVariantId: string | null = null

  for (const [index, variantInput] of input.variants.entries()) {
    const variantId = crypto.randomUUID()
    const versionId = crypto.randomUUID()

    await db.insert(productVariants).values({
      id: variantId,
      productId: input.id,
      label: variantInput.label,
      sortOrder: index,
      isSelectedFinal: variantInput.isSelectedFinal ?? false,
      macerationStartedAt: variantInput.macerationStartedAt ?? null,
      macerationTargetAt: variantInput.macerationTargetAt ?? null,
      macerationNotes: variantInput.macerationNotes ?? null,
      createdAt: created,
    })

    await db.insert(formulaVersions).values({
      id: versionId,
      productId: input.id,
      variantId,
      versionNumber: 1,
      label: 'v1',
      isCurrent: true,
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
        locked: false,
        sortOrder: rowIndex,
      })),
    )

    if (variantInput.isSelectedFinal) finalVariantId = variantId
  }

  await db.insert(chatThreads).values({
    id: crypto.randomUUID(),
    productId: input.id,
    mastraThreadId: `thread-${input.id}`,
    createdAt: created,
  })

  if (finalVariantId) {
    await setSelectedFinalVariant(input.id, finalVariantId, userId)
  } else {
    await refreshDerived(input.id, userId)
  }
}

async function main() {
  console.log(`Seeding rules ${RULES_VERSION}...`)
  await seedRules()
  const { userId, existed } = await seedDemoUser()
  if (existed) {
    console.log('Demo user already exists — rules refreshed, demo products left untouched.')
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
    brief: 'Oil-based EDP-style perfume. IFRA + EU allergen labelling.',
    variants: [
      {
        label: 'Variant 1 — softer',
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
        label: 'Variant 2 — original',
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
        label: 'Variant 3 — brighter top',
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
