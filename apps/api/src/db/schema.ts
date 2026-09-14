import { sqliteTable, text, integer, real, primaryKey } from 'drizzle-orm/sqlite-core'

export const organizations = sqliteTable('organizations', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  kind: text('kind', { enum: ['personal', 'team'] }).notNull().default('team'),
  createdAt: text('created_at').notNull(),
})

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  plan: text('plan', { enum: ['free', 'paid'] }).notNull().default('free'),
  agentQuotaUsed: integer('agent_quota_used').notNull().default(0),
  activeOrganizationId: text('active_organization_id').references(() => organizations.id),
  createdAt: text('created_at').notNull(),
})

export const organizationMembers = sqliteTable('organization_members', {
  id: text('id').primaryKey(),
  organizationId: text('organization_id').notNull().references(() => organizations.id),
  userId: text('user_id').notNull().references(() => users.id),
  role: text('role', { enum: ['owner', 'editor', 'viewer'] }).notNull().default('owner'),
  createdAt: text('created_at').notNull(),
})

export const products = sqliteTable('products', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  organizationId: text('organization_id').references(() => organizations.id),
  name: text('name').notNull(),
  type: text('type', { enum: ['skincare', 'perfume', 'hybrid'] }).notNull(),
  markets: text('markets').notNull(),
  brief: text('brief').notNull(),
  olfactoryPyramid: text('olfactory_pyramid'),
  claims: text('claims').notNull().default('[]'),
  status: text('status', { enum: ['draft', 'archived'] }).notNull().default('draft'),
  pinnedAt: text('pinned_at'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
})

export const productVariants = sqliteTable('product_variants', {
  id: text('id').primaryKey(),
  productId: text('product_id').notNull().references(() => products.id),
  label: text('label').notNull(),
  sortOrder: integer('sort_order').notNull(),
  isSelectedFinal: integer('is_selected_final', { mode: 'boolean' }).notNull().default(false),
  macerationStartedAt: text('maceration_started_at'),
  macerationTargetAt: text('maceration_target_at'),
  macerationNotes: text('maceration_notes'),
  createdAt: text('created_at').notNull(),
})

export const formulaVersions = sqliteTable('formula_versions', {
  id: text('id').primaryKey(),
  productId: text('product_id').notNull().references(() => products.id),
  variantId: text('variant_id').references(() => productVariants.id),
  versionNumber: integer('version_number').notNull(),
  label: text('label'),
  isCurrent: integer('is_current', { mode: 'boolean' }).notNull().default(false),
  frozenAt: text('frozen_at'),
  createdAt: text('created_at').notNull(),
})

export const formulaRows = sqliteTable('formula_rows', {
  id: text('id').notNull(),
  versionId: text('version_id').notNull().references(() => formulaVersions.id),
  inci: text('inci').notNull(),
  cas: text('cas'),
  tradeName: text('trade_name'),
  function: text('function').notNull(),
  phase: text('phase').notNull(),
  percent: real('percent').notNull(),
  notes: text('notes'),
  locked: integer('locked', { mode: 'boolean' }).notNull().default(false),
  sortOrder: integer('sort_order').notNull(),
}, (table) => [primaryKey({ columns: [table.versionId, table.id] })])

export const formulaPatches = sqliteTable('formula_patches', {
  id: text('id').primaryKey(),
  productId: text('product_id').notNull().references(() => products.id),
  variantId: text('variant_id').references(() => productVariants.id),
  baseVersionId: text('base_version_id').references(() => formulaVersions.id),
  status: text('status', { enum: ['pending', 'accepted', 'rejected'] }).notNull(),
  summary: text('summary').notNull(),
  operations: text('operations').notNull(),
  agentMessageId: text('agent_message_id'),
  createdAt: text('created_at').notNull(),
  resolvedAt: text('resolved_at'),
})

export const ingredients = sqliteTable('ingredients', {
  id: text('id').primaryKey(),
  organizationId: text('organization_id').notNull().references(() => organizations.id),
  inci: text('inci').notNull(),
  tradeName: text('trade_name'),
  cas: text('cas'),
  category: text('category', {
    enum: ['solvent', 'emollient', 'fragrance', 'preservative', 'antioxidant', 'carrier', 'active', 'other'],
  })
    .notNull()
    .default('other'),
  stockStatus: text('stock_status', { enum: ['in_house', 'low', 'to_buy'] })
    .notNull()
    .default('in_house'),
  animalDerived: text('animal_derived', { enum: ['yes', 'no', 'unknown'] })
    .notNull()
    .default('unknown'),
  originType: text('origin_type', { enum: ['natural', 'synthetic', 'unknown'] })
    .notNull()
    .default('unknown'),
  organicCertified: text('organic_certified', { enum: ['yes', 'no', 'unknown'] })
    .notNull()
    .default('unknown'),
  pricePerKg: real('price_per_kg'),
  onHandGrams: real('on_hand_grams'),
  notes: text('notes'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
})

export const ingredientRules = sqliteTable('ingredient_rules', {
  id: text('id').primaryKey(),
  version: text('version').notNull(),
  market: text('market').notNull(),
  instrument: text('instrument').notNull(),
  substance: text('substance').notNull(),
  inciNames: text('inci_names').notNull(),
  casNumbers: text('cas_numbers'),
  maxPercent: real('max_percent'),
  labelThresholdPercent: real('label_threshold_percent'),
  effect: text('effect').notNull(),
  citationUrl: text('citation_url').notNull(),
  message: text('message').notNull(),
  productTypes: text('product_types'),
  leaveOnOnly: integer('leave_on_only', { mode: 'boolean' }),
  ifraCategory: text('ifra_category'),
  preferredInci: text('preferred_inci'),
})

export const regulatoryChecks = sqliteTable('regulatory_checks', {
  id: text('id').primaryKey(),
  productId: text('product_id').notNull().references(() => products.id),
  market: text('market').notNull(),
  status: text('status').notNull(),
  hits: text('hits').notNull(),
  checkedAt: text('checked_at').notNull(),
})

export const pifDocuments = sqliteTable('pif_documents', {
  id: text('id').primaryKey(),
  productId: text('product_id').notNull().references(() => products.id),
  markdown: text('markdown').notNull(),
  sections: text('sections').notNull(),
  generatedAt: text('generated_at').notNull(),
})

export const chatThreads = sqliteTable('chat_threads', {
  id: text('id').primaryKey(),
  productId: text('product_id').notNull().references(() => products.id),
  mastraThreadId: text('mastra_thread_id').notNull(),
  createdAt: text('created_at').notNull(),
})

export const agentProposals = sqliteTable('agent_proposals', {
  id: text('id').primaryKey(),
  organizationId: text('organization_id').notNull().references(() => organizations.id),
  kind: text('kind', {
    enum: ['inventory_create', 'inventory_update', 'product_create'],
  }).notNull(),
  status: text('status', { enum: ['pending', 'accepted', 'rejected'] }).notNull(),
  summary: text('summary').notNull(),
  payload: text('payload').notNull(),
  createdAt: text('created_at').notNull(),
  resolvedAt: text('resolved_at'),
})

export const feedback = sqliteTable('feedback', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  organizationId: text('organization_id').references(() => organizations.id),
  message: text('message').notNull(),
  createdAt: text('created_at').notNull(),
})

// OAuth state is short-lived; only hashes of authorization codes and bearer tokens are stored.
export const mcpClients = sqliteTable('mcp_clients', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  redirectUris: text('redirect_uris').notNull(),
  createdAt: integer('created_at').notNull(),
})
export const mcpRequests = sqliteTable('mcp_requests', {
  id: text('id').primaryKey(),
  payload: text('payload').notNull(),
  expiresAt: integer('expires_at').notNull(),
})
export const mcpGrants = sqliteTable('mcp_grants', {
  id: text('id').primaryKey(),
  clientId: text('client_id').notNull(),
  userId: text('user_id').notNull().references(() => users.id),
  organizationId: text('organization_id').notNull().references(() => organizations.id),
  codeHash: text('code_hash'),
  codeExpiresAt: integer('code_expires_at').notNull(),
  challenge: text('challenge').notNull(),
  redirectUri: text('redirect_uri').notNull(),
  accessHash: text('access_hash'),
  accessExpiresAt: integer('access_expires_at'),
  refreshHash: text('refresh_hash'),
  expiresAt: integer('expires_at').notNull(),
  revokedAt: integer('revoked_at'),
  createdAt: integer('created_at').notNull(),
})
