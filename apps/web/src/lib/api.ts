import type {
  IngredientCategory,
  IngredientOriginType,
  IngredientStockStatus,
  ProductClaim,
  ProductStage,
  PurchaseSuggestion,
  TriStateFlag,
} from '@atelier/domain'

export type Plan = 'free' | 'paid'
export type { ProductStage, ProductClaim, TriStateFlag, IngredientOriginType }
export type MacerationStatus = 'fresh' | 'macerating' | 'ready'

export interface OlfactoryPyramid {
  direction: string
  top: string[]
  heart: string[]
  base: string[]
}

export interface AuthUser {
  id: string
  email: string
  plan: Plan
  activeOrganizationId?: string | null
}

export type OrganizationKind = 'personal' | 'team'
export type OrganizationRole = 'owner' | 'editor' | 'viewer'

export interface OrganizationSummary {
  id: string
  name: string
  kind: OrganizationKind
  role: OrganizationRole
  createdAt: string
}

export type ProductStatus = 'draft' | 'archived'

export interface ProductSummary {
  id: string
  name: string
  type: string
  markets: string[]
  brief: string
  claims?: ProductClaim[]
  olfactoryPyramid?: OlfactoryPyramid | null
  status: ProductStatus
  stage?: ProductStage
  pinnedAt?: string | null
  createdAt: string
  updatedAt: string
}

export interface FormulaRow {
  id: string
  inci: string
  cas?: string
  tradeName?: string
  function: string
  phase: string
  percent: number
  notes?: string
  locked: boolean
  sortOrder: number
}

export interface ProductVariant {
  id: string
  productId: string
  label: string
  sortOrder: number
  isSelectedFinal: boolean
  macerationStartedAt?: string | null
  macerationTargetAt?: string | null
  macerationNotes?: string | null
  macerationStatus?: MacerationStatus
  createdAt: string
}

export interface VariantWorkspace {
  variant: ProductVariant
  version: { id: string; versionNumber: number; label: string | null } | null
  rows: FormulaRow[]
}

export interface PatchOperation {
  op: 'add' | 'update' | 'remove' | 'reorder'
  row?: Partial<FormulaRow>
  rowId?: string
  changes?: Partial<FormulaRow>
  rowIds?: string[]
}

export interface FormulaPatch {
  id: string
  productId: string
  variantId?: string | null
  status: 'pending' | 'accepted' | 'rejected'
  summary: string
  operations: PatchOperation[]
  createdAt: string
}

export interface RegulatoryHit {
  market: string
  instrument: string
  substance: string
  inci: string
  limit?: string
  effect: string
  citationUrl: string
  message: string
}

export interface RegulatoryCheck {
  market: string
  status: string
  hits: RegulatoryHit[]
  checkedAt: string
}

export interface PifSection {
  id: string
  title: string
  content: string
  isGap: boolean
}

export interface InventoryIngredient {
  id: string
  inci: string
  tradeName?: string
  cas?: string
  category: IngredientCategory
  stockStatus: IngredientStockStatus
  animalDerived: TriStateFlag
  originType: IngredientOriginType
  organicCertified: TriStateFlag
  pricePerKg?: number
  onHandGrams?: number
  notes?: string
  createdAt: string
  updatedAt: string
}

export interface IngredientInput {
  inci: string
  tradeName?: string | null
  cas?: string | null
  category: IngredientCategory
  stockStatus: IngredientStockStatus
  animalDerived: TriStateFlag
  originType: IngredientOriginType
  organicCertified: TriStateFlag
  pricePerKg?: number | null
  onHandGrams?: number | null
  notes?: string | null
}

export type HomeAttentionKind =
  | 'banned'
  | 'restricted'
  | 'claim_block'
  | 'unbalanced'
  | 'maceration_ready'
  | 'macerating'

export interface HomeAttention {
  id: string
  kind: HomeAttentionKind
  href: string
  productName: string
  variantLabel?: string
  inci?: string
  claim?: ProductClaim
  daysLeft?: number
  totalPercent?: number
}

export interface HomeFormulaCost {
  productId: string
  productName: string
  variantLabel: string
  href: string
  costPerKg: number | null
  pricedPercent: number
  hasGap: boolean
}

export interface HomeDashboard {
  shelf: {
    value: number
    valuedCount: number
    shelfCount: number
    pricedCount: number
  }
  purchaseCount: number
  formulaCost: {
    completeCount: number
    totalCount: number
  }
  purchaseSuggestions: PurchaseSuggestion[]
  attention: HomeAttention[]
  formulaCosts: HomeFormulaCost[]
}

export interface Workspace {
  product: ProductSummary
  stage: ProductStage
  variants: VariantWorkspace[]
  selectedFinalVariantId: string | null
  activeVariantId: string | null
  patches: FormulaPatch[]
  pif: { markdown: string; sections: PifSection[]; generatedAt: string } | null
  checks: RegulatoryCheck[]
  thread: { mastraThreadId: string } | null
}

export type AgentProposalKind = 'inventory_create' | 'inventory_update' | 'product_create'

export interface AgentProposal {
  id: string
  organizationId: string
  kind: AgentProposalKind
  status: 'pending' | 'accepted' | 'rejected'
  summary: string
  payload: unknown
  createdAt: string
  resolvedAt: string | null
}

export interface InventoryProposalPayload {
  ingredientId?: string
  ingredient: IngredientInput
}

export interface ProductProposalPayload {
  name: string
  type: string
  markets: string[]
  brief: string
  claims?: ProductClaim[]
  formula?: Array<{
    inci: string
    function: string
    phase: string
    percent: number
    notes?: string
  }>
}

const TOKEN_KEY = 'atelier_token'

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token)
  else localStorage.removeItem(TOKEN_KEY)
}

export class ApiError extends Error {
  status: number
  code?: string
  constructor(message: string, status: number, code?: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

async function throwIfNotOk(res: Response) {
  if (res.ok) return
  const body = await res.json().catch(() => ({}))
  throw new ApiError(body.message || body.error || `Request failed (${res.status})`, res.status, body.code)
}

function authHeaders(): Record<string, string> {
  const token = getToken()
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { ...authHeaders(), ...(init?.headers as Record<string, string> | undefined) },
  })
  await throwIfNotOk(res)
  return res.json() as Promise<T>
}

export const api = {
  login: (email: string, password: string) =>
    request<{ user: AuthUser; token: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  register: (email: string, password: string) =>
    request<{ user: AuthUser; token: string }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  me: () => request<{ user: AuthUser }>('/auth/me'),
  updatePlan: (plan: Plan) =>
    request<{ user: AuthUser }>('/app/plan', {
      method: 'PATCH',
      body: JSON.stringify({ plan }),
    }),
  listOrganizations: () =>
    request<{ organizations: OrganizationSummary[]; currentOrganizationId: string | null }>(
      '/app/organizations',
    ),
  createOrganization: (name: string) =>
    request<{ organization: OrganizationSummary; organizations: OrganizationSummary[]; user: AuthUser }>(
      '/app/organizations',
      {
        method: 'POST',
        body: JSON.stringify({ name }),
      },
    ),
  sendFeedback: (message: string) =>
    request<{ feedback: { id: string; createdAt: string } }>('/app/feedback', {
      method: 'POST',
      body: JSON.stringify({ message }),
    }),
  renameOrganization: (organizationId: string, name: string) =>
    request<{ organization: OrganizationSummary }>(`/app/organizations/${organizationId}`, {
      method: 'PATCH',
      body: JSON.stringify({ name }),
    }),
  setActiveOrganization: (organizationId: string) =>
    request<{ organization: OrganizationSummary; user: AuthUser }>('/app/active-organization', {
      method: 'PATCH',
      body: JSON.stringify({ organizationId }),
    }),
  getHome: () => request<HomeDashboard>('/app/home'),
  listIngredients: () => request<{ ingredients: InventoryIngredient[] }>('/app/ingredients'),
  createIngredient: (input: IngredientInput) =>
    request<{ ingredient: InventoryIngredient }>('/app/ingredients', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  updateIngredient: (ingredientId: string, input: IngredientInput) =>
    request<{ ingredient: InventoryIngredient }>(`/app/ingredients/${ingredientId}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    }),
  deleteIngredient: (ingredientId: string) =>
    request<{ ok: boolean }>(`/app/ingredients/${ingredientId}`, { method: 'DELETE' }),
  listProducts: (options?: { archived?: boolean }) =>
    request<{ products: ProductSummary[] }>(
      options?.archived ? '/app/products?archived=1' : '/app/products',
    ),
  createProduct: (input: {
    name: string
    type: string
    markets: string[]
    brief: string
    claims?: ProductClaim[]
  }) =>
    request<{ product: ProductSummary }>('/app/products', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  duplicateProduct: (productId: string, name: string) =>
    request<{ product: ProductSummary }>(`/app/products/${productId}/duplicate`, {
      method: 'POST',
      body: JSON.stringify({ name }),
    }),
  deleteProduct: (productId: string) =>
    request<{ ok: boolean }>(`/app/products/${productId}`, { method: 'DELETE' }),
  getWorkspace: (productId: string) =>
    request<Workspace>(`/app/products/${productId}`),
  updateProductName: (productId: string, name: string) =>
    request<{ workspace: Workspace }>(`/app/products/${productId}`, {
      method: 'PATCH',
      body: JSON.stringify({ name }),
    }),
  updateProductBrief: (productId: string, brief: string) =>
    request<{ workspace: Workspace }>(`/app/products/${productId}`, {
      method: 'PATCH',
      body: JSON.stringify({ brief }),
    }),
  setProductPinned: (productId: string, pinned: boolean) =>
    request<{ workspace: Workspace }>(`/app/products/${productId}`, {
      method: 'PATCH',
      body: JSON.stringify({ pinned }),
    }),
  setProductArchived: (productId: string, archived: boolean) =>
    request<{ workspace: Workspace }>(`/app/products/${productId}`, {
      method: 'PATCH',
      body: JSON.stringify({ archived }),
    }),
  updateProductClaims: (productId: string, claims: ProductClaim[]) =>
    request<{ workspace: Workspace }>(`/app/products/${productId}`, {
      method: 'PATCH',
      body: JSON.stringify({ claims }),
    }),
  saveOlfactoryPyramid: (productId: string, pyramid: OlfactoryPyramid) =>
    request<{ workspace: Workspace }>(`/app/products/${productId}/olfactory-pyramid`, {
      method: 'PUT',
      body: JSON.stringify(pyramid),
    }),
  saveFormula: (productId: string, variantId: string, rows: FormulaRow[], expectedVersionId: string | null) =>
    request<{ versionId: string; workspace: Workspace }>(
      `/app/products/${productId}/formula`,
      { method: 'PUT', body: JSON.stringify({ variantId, rows, expectedVersionId }) },
    ),
  createVariant: (
    productId: string,
    input: { label?: string; copyFromVariantId?: string },
  ) =>
    request<{ variant: ProductVariant; workspace: Workspace }>(
      `/app/products/${productId}/variants`,
      { method: 'POST', body: JSON.stringify(input) },
    ),
  updateVariant: (
    productId: string,
    variantId: string,
    input: {
      label?: string
      macerationStartedAt?: string | null
      macerationTargetAt?: string | null
      macerationNotes?: string | null
    },
  ) =>
    request<{ workspace: Workspace }>(`/app/products/${productId}/variants/${variantId}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    }),
  setFinalVariant: (productId: string, variantId: string) =>
    request<{ workspace: Workspace }>(
      `/app/products/${productId}/variants/${variantId}/final`,
      { method: 'PATCH' },
    ),
  resolvePatch: (productId: string, patchId: string, action: 'accepted' | 'rejected') =>
    request<{ workspace: Workspace }>(`/app/products/${productId}/patches/${patchId}`, {
      method: 'POST',
      body: JSON.stringify({ action }),
    }),
  listProposals: () => request<{ proposals: AgentProposal[] }>('/app/proposals'),
  resolveProposal: (proposalId: string, action: 'accepted' | 'rejected') =>
    request<{
      proposal: AgentProposal
      ingredient?: InventoryIngredient
      product?: ProductSummary
    }>(`/app/proposals/${proposalId}`, {
      method: 'POST',
      body: JSON.stringify({ action }),
    }),
  streamAgent: async (
    input: {
      userId: string
      threadId: string
      message: string
      productId?: string
      variantId?: string
    },
    onChunk: (text: string) => void,
  ) => {
    // No userId here: the API derives it from the bearer token and overwrites
    // whatever the payload claims. Only the on-screen context travels with the call.
    const requestContext: Record<string, string> = {}
    if (input.productId) requestContext.productId = input.productId
    if (input.variantId) requestContext.variantId = input.variantId

    const res = await fetch('/api/agents/assistantAgent/stream', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        messages: [{ role: 'user', content: input.message }],
        memory: { resource: input.userId, thread: input.threadId },
        requestContext,
      }),
    })

    await throwIfNotOk(res)

    const reader = res.body?.getReader()
    if (!reader) return

    const decoder = new TextDecoder()
    let buffer = ''
    let gotText = false

    const handleEvent = (json: { type?: string; payload?: { text?: string; delta?: string; error?: { message?: string } | string }; text?: string; delta?: string; error?: { message?: string } | string }) => {
      if (json.type === 'error') {
        const err = json.payload?.error ?? json.error
        const message =
          typeof err === 'string'
            ? err
            : err && typeof err.message === 'string'
              ? err.message
              : 'Agent failed'
        throw new Error(message.trim() || 'Agent failed')
      }
      const text =
        json.type === 'text-delta'
          ? json.payload?.text ?? json.payload?.delta ?? json.delta ?? json.text
          : json.type === 'text'
            ? json.text
            : undefined
      if (typeof text === 'string' && text) {
        gotText = true
        onChunk(text)
      }
    }

    const consume = (chunk: string) => {
      buffer += chunk
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed) continue
        const payload = trimmed.startsWith('data:') ? trimmed.slice(5).trim() : trimmed
        if (!payload || payload === '[DONE]') continue
        try {
          handleEvent(JSON.parse(payload))
        } catch (err) {
          if (err instanceof SyntaxError) continue
          throw err
        }
      }
    }

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      consume(decoder.decode(value, { stream: true }))
    }
    if (buffer.trim()) consume('\n')
    if (!gotText) throw new Error('Agent failed')
  },
}

export const OFFICIAL_LINKS = [
  { label: 'EU CosIng', url: 'https://ec.europa.eu/growth/sectors/cosmetics/cosing_en' },
  {
    label: 'EUR-Lex 1223/2009',
    url: 'https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32009R1223',
  },
  { label: 'IFRA Standards', url: 'https://ifrafragrance.org/standards' },
  {
    label: 'ASEAN Cosmetic Directive',
    url: 'https://asean.org/our-communities/economic-community/integration-with-global-economy/asean-cosmetic-directive/',
  },
]
