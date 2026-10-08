import {
  IngredientInputSchema,
  InventoryCreatePayloadSchema,
  InventoryUpdatePayloadSchema,
  ProductCreatePayloadSchema,
  type AgentProposalKind,
  type AgentProposalStatus,
  type IngredientInput,
} from '@formulario/domain'
import { and, desc, eq } from 'drizzle-orm'
import { db } from '../db/client.js'
import { agentProposals } from '../db/schema.js'
import { getActiveOrganizationId } from './organizations.js'
import { createIngredient, updateIngredient } from './ingredients.js'
import { createProduct, refreshDerived } from './products.js'

export type AgentProposalRecord = {
  id: string
  organizationId: string
  kind: AgentProposalKind
  status: AgentProposalStatus
  summary: string
  payload: unknown
  createdAt: string
  resolvedAt: string | null
}

function parseJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

function fromDb(row: typeof agentProposals.$inferSelect): AgentProposalRecord {
  return {
    id: row.id,
    organizationId: row.organizationId,
    kind: row.kind,
    status: row.status,
    summary: row.summary,
    payload: parseJson(row.payload, {}),
    createdAt: row.createdAt,
    resolvedAt: row.resolvedAt,
  }
}

function toIngredientInput(record: {
  inci: string
  tradeName?: string
  cas?: string
  category: IngredientInput['category']
  stockStatus: IngredientInput['stockStatus']
  animalDerived: IngredientInput['animalDerived']
  originType: IngredientInput['originType']
  organicCertified: IngredientInput['organicCertified']
  pricePerKg?: number
  onHandGrams?: number
  notes?: string
}): IngredientInput {
  return IngredientInputSchema.parse({
    inci: record.inci,
    tradeName: record.tradeName ?? null,
    cas: record.cas ?? null,
    category: record.category,
    stockStatus: record.stockStatus,
    animalDerived: record.animalDerived,
    originType: record.originType,
    organicCertified: record.organicCertified,
    pricePerKg: record.pricePerKg ?? null,
    onHandGrams: record.onHandGrams ?? null,
    notes: record.notes ?? null,
  })
}

export async function createProposal(input: {
  userId: string
  kind: AgentProposalKind
  summary: string
  payload: unknown
}) {
  const organizationId = await getActiveOrganizationId(input.userId)
  if (!organizationId) throw new Error('No organisation')

  const id = crypto.randomUUID()
  const now = new Date().toISOString()
  await db.insert(agentProposals).values({
    id,
    organizationId,
    kind: input.kind,
    status: 'pending',
    summary: input.summary,
    payload: JSON.stringify(input.payload),
    createdAt: now,
  })

  const [created] = await db.select().from(agentProposals).where(eq(agentProposals.id, id)).limit(1)
  if (!created) throw new Error('Failed to load proposal')
  return fromDb(created)
}

export async function listPendingProposals(userId: string) {
  const organizationId = await getActiveOrganizationId(userId)
  if (!organizationId) return []
  const rows = await db
    .select()
    .from(agentProposals)
    .where(and(eq(agentProposals.organizationId, organizationId), eq(agentProposals.status, 'pending')))
    .orderBy(desc(agentProposals.createdAt))
  return rows.map(fromDb)
}

export async function resolveProposal(
  userId: string,
  proposalId: string,
  action: 'accepted' | 'rejected',
) {
  const organizationId = await getActiveOrganizationId(userId)
  if (!organizationId) return null

  const [row] = await db
    .select()
    .from(agentProposals)
    .where(and(eq(agentProposals.id, proposalId), eq(agentProposals.organizationId, organizationId)))
    .limit(1)
  if (!row || row.status !== 'pending') return null

  const now = new Date().toISOString()
  const proposal = fromDb({ ...row, status: action, resolvedAt: now })

  async function markResolved() {
    await db
      .update(agentProposals)
      .set({ status: action, resolvedAt: now })
      .where(eq(agentProposals.id, proposalId))
  }

  if (action === 'rejected') {
    await markResolved()
    return { proposal }
  }

  // Apply the change first. If it throws (duplicate INCI, bad payload…) the proposal stays
  // pending so the person can retry or reject it, instead of being stuck as "accepted".
  if (proposal.kind === 'inventory_create') {
    const payload = InventoryCreatePayloadSchema.parse(proposal.payload)
    const ingredient = await createIngredient(userId, payload.ingredient)
    await markResolved()
    return { proposal, ingredient }
  }

  if (proposal.kind === 'inventory_update') {
    const payload = InventoryUpdatePayloadSchema.parse(proposal.payload)
    const ingredient = await updateIngredient(userId, payload.ingredientId, payload.ingredient)
    if (!ingredient) return null
    await markResolved()
    return { proposal, ingredient }
  }

  const payload = ProductCreatePayloadSchema.parse(proposal.payload)
  const product = await createProduct({
    userId,
    name: payload.name,
    type: payload.type,
    markets: payload.markets,
    brief: payload.brief,
    claims: payload.claims,
  })
  await refreshDerived(product.id, userId)
  await markResolved()
  return { proposal, product }
}

export { toIngredientInput }
