import { SEED_RULES, RULES_VERSION } from '@atelier/domain'
import { eq } from 'drizzle-orm'
import { db } from './client.js'
import {
  chatThreads,
  formulaPatches,
  formulaRows,
  formulaVersions,
  ingredientRules,
  organizations,
  pifDocuments,
  productVariants,
  products,
  regulatoryChecks,
  users,
} from './schema.js'
import { hashPassword } from '../lib/auth.js'
import { ensurePersonalOrganization } from '../services/organizations.js'
import { refreshDerived, setSelectedFinalVariant } from '../services/products.js'
import { seedDemoIngredients } from '../services/ingredients.js'
import {
  assertDemoFormulasBalanced,
  DEMO_PRODUCTS,
  RETIRED_DEMO_PRODUCT_IDS,
  type SeedProduct,
} from './demo-products.js'

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
  if (existing) return userId
  await db.insert(users).values({
    id: userId,
    email: 'demo@local.test',
    passwordHash: await hashPassword('demo'),
    plan: 'free',
    createdAt: now(),
  })
  return userId
}

async function ensureDemoOrganization(userId: string) {
  const personal = await ensurePersonalOrganization(userId)
  if (personal.name === 'Personal') {
    await db.update(organizations).set({ name: 'Design partner demo' }).where(eq(organizations.id, personal.id))
    return { ...personal, name: 'Design partner demo' }
  }
  return personal
}

async function removeProduct(productId: string) {
  const versions = await db
    .select({ id: formulaVersions.id })
    .from(formulaVersions)
    .where(eq(formulaVersions.productId, productId))
  for (const version of versions) {
    await db.delete(formulaRows).where(eq(formulaRows.versionId, version.id))
  }
  await db.delete(formulaVersions).where(eq(formulaVersions.productId, productId))
  await db.delete(formulaPatches).where(eq(formulaPatches.productId, productId))
  await db.delete(regulatoryChecks).where(eq(regulatoryChecks.productId, productId))
  await db.delete(pifDocuments).where(eq(pifDocuments.productId, productId))
  await db.delete(chatThreads).where(eq(chatThreads.productId, productId))
  await db.delete(productVariants).where(eq(productVariants.productId, productId))
  await db.delete(products).where(eq(products.id, productId))
}

async function seedProductWithVariants(userId: string, organizationId: string, input: SeedProduct, pinnedAt?: string) {
  const created = now()
  await db.insert(products).values({
    id: input.id,
    userId,
    organizationId,
    name: input.name,
    type: input.type,
    markets: JSON.stringify(input.markets),
    brief: input.brief,
    claims: JSON.stringify(input.claims ?? []),
    olfactoryPyramid: input.olfactoryPyramid ? JSON.stringify(input.olfactoryPyramid) : null,
    status: 'draft',
    pinnedAt: input.pinned ? (pinnedAt ?? created) : null,
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
      isSelectedFinal: false,
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
        tradeName: row.tradeName ?? null,
        function: row.function,
        phase: row.phase,
        percent: row.percent,
        notes: row.notes ?? null,
        locked: row.locked ?? false,
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
  assertDemoFormulasBalanced()
  console.log(`Seeding rules ${RULES_VERSION}...`)
  await seedRules()
  const userId = await seedDemoUser()
  const personal = await ensureDemoOrganization(userId)
  await seedDemoIngredients(personal.id)

  for (const productId of RETIRED_DEMO_PRODUCT_IDS) {
    await removeProduct(productId)
  }

  const pinBase = Date.now()
  const pinnedCount = DEMO_PRODUCTS.filter((product) => product.pinned).length
  let pinIndex = 0
  for (const product of DEMO_PRODUCTS) {
    await removeProduct(product.id)
    const pinnedAt = product.pinned
      ? new Date(pinBase + (pinnedCount - pinIndex++) * 1000).toISOString()
      : undefined
    await seedProductWithVariants(userId, personal.id, product, pinnedAt)
  }

  console.log('Seed complete. Demo login: demo@local.test / demo')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
