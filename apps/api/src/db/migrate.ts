import { migrate } from 'drizzle-orm/libsql/migrator'
import { eq, isNull } from 'drizzle-orm'
import { db, libsql } from './client.js'
import { formulaVersions, productVariants, products, users } from './schema.js'
import { ensurePersonalOrganization } from '../services/organizations.js'
import {
  backfillIngredientClaimFlags,
  backfillIngredientOnHand,
  backfillIngredientPrices,
  seedDemoIngredients,
} from '../services/ingredients.js'
import { seedDemoSuppliers } from '../services/suppliers.js'
import { refreshDerived } from '../services/products.js'

async function backfillVariants() {
  const allProducts = await db.select().from(products)
  for (const product of allProducts) {
    const existingVariants = await db
      .select()
      .from(productVariants)
      .where(eq(productVariants.productId, product.id))

    if (existingVariants.length > 0) continue

    const now = new Date().toISOString()
    const variantId = crypto.randomUUID()
    await db.insert(productVariants).values({
      id: variantId,
      productId: product.id,
      label: product.type === 'perfume' ? 'Variant 1' : 'Main',
      sortOrder: 0,
      isSelectedFinal: false,
      createdAt: now,
    })

    const versions = await db
      .select()
      .from(formulaVersions)
      .where(eq(formulaVersions.productId, product.id))

    for (const version of versions) {
      if (!version.variantId) {
        await db
          .update(formulaVersions)
          .set({ variantId })
          .where(eq(formulaVersions.id, version.id))
      }
    }
  }

  const orphanVersions = await db
    .select()
    .from(formulaVersions)
    .where(isNull(formulaVersions.variantId))

  for (const version of orphanVersions) {
    const [variant] = await db
      .select()
      .from(productVariants)
      .where(eq(productVariants.productId, version.productId))
      .limit(1)
    if (variant) {
      await db
        .update(formulaVersions)
        .set({ variantId: variant.id })
        .where(eq(formulaVersions.id, version.id))
    }
  }
}

async function backfillOrganizations() {
  const allUsers = await db.select({ id: users.id }).from(users)
  for (const user of allUsers) {
    await ensurePersonalOrganization(user.id)
  }
}

async function backfillDemoIngredients() {
  const [demo] = await db.select({ id: users.id }).from(users).where(eq(users.id, 'demo-user-id')).limit(1)
  if (!demo) return
  const personal = await ensurePersonalOrganization(demo.id)
  await seedDemoIngredients(personal.id)
  await seedDemoSuppliers(personal.id)
  await backfillIngredientClaimFlags()
  await backfillIngredientPrices()
  await backfillIngredientOnHand()
}

async function backfillDemoProductClaims() {
  const [faceOil] = await db.select().from(products).where(eq(products.id, 'prod-face-oil')).limit(1)
  if (!faceOil) return
  const claims = faceOil.claims?.trim()
  if (!claims || claims === '[]') {
    await db
      .update(products)
      .set({
        claims: JSON.stringify(['vegan', 'natural']),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(products.id, 'prod-face-oil'))
  }
  await refreshDerived('prod-face-oil', 'demo-user-id')
}

async function main() {
  await migrate(db, { migrationsFolder: './drizzle' })
  await backfillVariants()
  await backfillOrganizations()
  await backfillDemoIngredients()
  await backfillDemoProductClaims()
  console.log('Migrations complete')
  libsql.close()
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
