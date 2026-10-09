import { registerApiRoute } from '@mastra/core/server'
import { MASTRA_RESOURCE_ID_KEY } from '@mastra/core/request-context'
import { z } from 'zod'
import {
  FormulaRowSchema,
  IngredientCategorySchema,
  IngredientOriginTypeSchema,
  IngredientStockStatusSchema,
  MarketSchema,
  ProductClaimSchema,
  ProductTypeSchema,
  TriStateFlagSchema,
} from '@formulario/domain'
import { canUseAssistant, PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from '@formulario/domain'
import {
  authenticateUser,
  changePassword,
  getUserById,
  normalizeEmail,
  PasswordError,
  signAppToken,
  updateUserPlan,
  verifyAppToken,
  type AuthUser,
  type PasswordErrorCode,
} from '../../lib/auth.js'
import {
  commitNewVersion,
  ProductWriteError,
  createProduct,
  createVariant,
  deleteProduct,
  duplicateProduct,
  getWorkspace,
  listProducts,
  refreshDerived,
  renameVariant,
  resolvePatch,
  setProductArchived,
  setSelectedFinalVariant,
  updateMaceration,
  setProductPinned,
  updateOlfactoryPyramid,
  updateProductBrief,
  updateProductClaims,
  updateProductName,
} from '../../services/products.js'
import {
  createOrganization,
  getOrganizationForUser,
  listOrganizations,
  renameOrganization,
  setActiveOrganization,
} from '../../services/organizations.js'
import {
  createIngredient,
  deleteIngredient,
  listIngredients,
  updateIngredient,
} from '../../services/ingredients.js'
import { getHomeDashboard } from '../../services/home.js'
import { listPendingProposals, resolveProposal } from '../../services/proposals.js'
import { createFeedback } from '../../services/feedback.js'
import { libsql } from '../../db/client.js'
import { clearLoginFailures, loginRetryAfter, recordLoginFailure } from '../../lib/login-throttle.js'

type HonoLike = {
  req: {
    header: (name: string) => string | undefined
    json: () => Promise<unknown>
    param: (name: string) => string
    query?: (name: string) => string | undefined
  }
  json: (body: unknown, status?: number) => Response
}

type AgentRequestContext = { set: (key: string, value: unknown) => void }

type BearerContext = { req: { header: (name: string) => string | undefined } }

const productNameSchema = z.string().trim().min(1).max(120)
const organizationNameSchema = z.string().trim().min(1).max(80)
const ingredientInputSchema = z.object({
  inci: z.string().trim().min(1).max(120),
  tradeName: z.string().trim().max(120).optional().nullable(),
  cas: z.string().trim().max(40).optional().nullable(),
  category: IngredientCategorySchema,
  stockStatus: IngredientStockStatusSchema,
  animalDerived: TriStateFlagSchema.default('unknown'),
  originType: IngredientOriginTypeSchema.default('unknown'),
  organicCertified: TriStateFlagSchema.default('unknown'),
  pricePerKg: z.number().nonnegative().max(1_000_000).nullable().optional(),
  onHandGrams: z.number().nonnegative().max(10_000_000).nullable().optional(),
  notes: z.string().trim().max(500).optional().nullable(),
})

function getBearer(c: BearerContext) {
  const header = c.req.header('authorization')
  if (!header?.startsWith('Bearer ')) return null
  return header.slice(7)
}

async function requireUser(c: BearerContext): Promise<AuthUser | null> {
  const token = getBearer(c)
  if (!token) return null
  return verifyAppToken(token)
}

const passwordErrorText: Record<PasswordErrorCode, string> = {
  too_short: `Use at least ${PASSWORD_MIN_LENGTH} characters.`,
  too_long: `Use at most ${PASSWORD_MAX_LENGTH} characters.`,
  has_space: 'Do not use spaces.',
  needs_letter: 'Include at least one letter.',
  needs_number: 'Include at least one number.',
  needs_special: 'Include at least one special character.',
  common: 'That password is too common. Choose another.',
  context: 'Do not use your email or the name Formulario.',
  same: 'Choose a password that is different from the one you use now.',
  wrong_current: 'That password is not right.',
}

async function withUser(
  c: HonoLike,
  handler: (user: AuthUser) => Promise<Response>,
  options?: { allowPendingPassword?: boolean },
) {
  const user = await requireUser(c)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)
  if (user.mustChangePassword && !options?.allowPendingPassword) {
    return c.json(
      { error: 'Choose a new password before continuing.', code: 'password_change_required' },
      403,
    )
  }
  try {
    return await handler(user)
  } catch (error) {
    if (error instanceof ProductWriteError) {
      return c.json({ error: error.message, code: error.code }, error.status)
    }
    if (error instanceof z.ZodError) return c.json({ error: 'Invalid request' }, 400)
    throw error
  }
}

export const healthRoutes = [
  registerApiRoute('/healthz', {
    method: 'GET',
    requiresAuth: false,
    handler: async (c) => {
      try {
        await libsql.execute('select 1')
        return c.json({ ok: true })
      } catch {
        return c.json({ ok: false }, 503)
      }
    },
  }),
]

export const authRoutes = [
  registerApiRoute('/auth/register', {
    method: 'POST',
    requiresAuth: false,
    handler: async (c) => c.json({ error: 'Registration is closed', code: 'registration_closed' }, 403),
  }),
  registerApiRoute('/auth/login', {
    method: 'POST',
    requiresAuth: false,
    handler: async (c) => {
      const parsed = z
        .object({ email: z.string().email(), password: z.string() })
        .safeParse(await c.req.json())
      if (!parsed.success) return c.json({ error: 'Invalid input' }, 400)
      const email = normalizeEmail(parsed.data.email)
      const retryAfter = loginRetryAfter(email)
      if (retryAfter > 0) {
        return c.json(
          {
            error: 'Too many attempts',
            message: `Too many sign-in attempts. Try again in ${Math.ceil(retryAfter / 60)} minutes.`,
          },
          429,
          { 'Retry-After': String(retryAfter) },
        )
      }
      const user = await authenticateUser(email, parsed.data.password)
      if (!user) {
        recordLoginFailure(email)
        return c.json({ error: 'Invalid credentials' }, 401)
      }
      clearLoginFailures(email)
      const token = await signAppToken(user)
      return c.json({ user, token })
    },
  }),
  registerApiRoute('/auth/me', {
    method: 'GET',
    requiresAuth: false,
    handler: async (c) =>
      withUser(c, async (user) => c.json({ user }), {
        allowPendingPassword: true,
      }),
  }),
  registerApiRoute('/auth/password', {
    method: 'POST',
    requiresAuth: false,
    handler: async (c) => {
      const user = await requireUser(c)
      if (!user) return c.json({ error: 'Unauthorized' }, 401)
      const parsed = z
        .object({ currentPassword: z.string().optional(), newPassword: z.string() })
        .safeParse(await c.req.json())
      if (!parsed.success) return c.json({ error: 'Invalid input' }, 400)
      try {
        const updated = await changePassword(user.id, parsed.data.newPassword, parsed.data.currentPassword)
        return c.json({ user: updated })
      } catch (error) {
        if (error instanceof PasswordError) {
          return c.json({ error: passwordErrorText[error.code], code: error.code }, 400)
        }
        throw error
      }
    },
  }),
]

export const appRoutes = [
  registerApiRoute('/app/plan', {
    method: 'PATCH',
    requiresAuth: false,
    handler: async (c) =>
      withUser(c, async (user) => {
        // Accounts cannot upgrade themselves in production. Use `users:create --plan`.
        if (process.env.NODE_ENV === 'production') {
          return c.json({ error: 'Plans are managed by Formulario.' }, 403)
        }
        const plan = z.enum(['free', 'paid']).parse((await c.req.json() as { plan: unknown }).plan)
        await updateUserPlan(user.id, plan)
        const updated = await getUserById(user.id)
        return c.json({ user: updated })
      }),
  }),
  registerApiRoute('/app/organizations', {
    method: 'GET',
    requiresAuth: false,
    handler: async (c) =>
      withUser(c, async (user) => {
        const organizations = await listOrganizations(user.id)
        return c.json({
          organizations,
          currentOrganizationId: user.activeOrganizationId ?? organizations[0]?.id ?? null,
        })
      }),
  }),
  registerApiRoute('/app/organizations', {
    method: 'POST',
    requiresAuth: false,
    handler: async (c) =>
      withUser(c, async (user) => {
        const body = z.object({ name: organizationNameSchema }).parse(await c.req.json())
        const organization = await createOrganization(user.id, body.name)
        const organizations = await listOrganizations(user.id)
        const updated = await getUserById(user.id)
        return c.json({ organization, organizations, user: updated }, 201)
      }),
  }),
  registerApiRoute('/app/organizations/:organizationId', {
    method: 'PATCH',
    requiresAuth: false,
    handler: async (c) =>
      withUser(c, async (user) => {
        const body = z.object({ name: organizationNameSchema }).parse(await c.req.json())
        const organization = await renameOrganization(c.req.param('organizationId'), user.id, body.name)
        if (!organization) return c.json({ error: 'Not found' }, 404)
        return c.json({ organization })
      }),
  }),
  registerApiRoute('/app/active-organization', {
    method: 'PATCH',
    requiresAuth: false,
    handler: async (c) =>
      withUser(c, async (user) => {
        const body = z.object({ organizationId: z.string().min(1) }).parse(await c.req.json())
        const organizationId = await setActiveOrganization(user.id, body.organizationId)
        if (!organizationId) return c.json({ error: 'Not found' }, 404)
        const organization = await getOrganizationForUser(organizationId, user.id)
        const updated = await getUserById(user.id)
        return c.json({ organization, user: updated })
      }),
  }),
  registerApiRoute('/app/home', {
    method: 'GET',
    requiresAuth: false,
    handler: async (c) => withUser(c, async (user) => c.json(await getHomeDashboard(user.id))),
  }),
  registerApiRoute('/app/ingredients', {
    method: 'GET',
    requiresAuth: false,
    handler: async (c) =>
      withUser(c, async (user) => c.json({ ingredients: await listIngredients(user.id) })),
  }),
  registerApiRoute('/app/ingredients', {
    method: 'POST',
    requiresAuth: false,
    handler: async (c) =>
      withUser(c, async (user) => {
        const parsed = ingredientInputSchema.safeParse(await c.req.json())
        if (!parsed.success) return c.json({ error: 'Invalid input' }, 400)
        try {
          const ingredient = await createIngredient(user.id, parsed.data)
          return c.json({ ingredient }, 201)
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Could not save ingredient'
          const status = message.includes('already') ? 409 : 400
          return c.json({ error: message }, status)
        }
      }),
  }),
  registerApiRoute('/app/ingredients/:ingredientId', {
    method: 'PATCH',
    requiresAuth: false,
    handler: async (c) =>
      withUser(c, async (user) => {
        const parsed = ingredientInputSchema.safeParse(await c.req.json())
        if (!parsed.success) return c.json({ error: 'Invalid input' }, 400)
        try {
          const ingredient = await updateIngredient(user.id, c.req.param('ingredientId'), parsed.data)
          if (!ingredient) return c.json({ error: 'Not found' }, 404)
          return c.json({ ingredient })
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Could not save ingredient'
          const status = message.includes('already') ? 409 : 400
          return c.json({ error: message }, status)
        }
      }),
  }),
  registerApiRoute('/app/ingredients/:ingredientId', {
    method: 'DELETE',
    requiresAuth: false,
    handler: async (c) =>
      withUser(c, async (user) => {
        const removed = await deleteIngredient(user.id, c.req.param('ingredientId'))
        if (!removed) return c.json({ error: 'Not found' }, 404)
        return c.json({ ok: true })
      }),
  }),
  registerApiRoute('/app/products', {
    method: 'GET',
    requiresAuth: false,
    handler: async (c) =>
      withUser(c, async (user) => {
        const archived = c.req.query?.('archived') === '1' || c.req.query?.('archived') === 'true'
        return c.json({ products: await listProducts(user.id, { archived }) })
      }),
  }),
  registerApiRoute('/app/products', {
    method: 'POST',
    requiresAuth: false,
    handler: async (c) =>
      withUser(c, async (user) => {
        const parsed = z
          .object({
            name: productNameSchema,
            type: ProductTypeSchema.default('skincare'),
            markets: z.array(MarketSchema).default(['EU']),
            brief: z.string().default(''),
            claims: z.array(ProductClaimSchema).optional(),
          })
          .safeParse(await c.req.json())
        if (!parsed.success) return c.json({ error: 'Invalid input' }, 400)

        const product = await createProduct({
          userId: user.id,
          name: parsed.data.name,
          type: parsed.data.type,
          markets: parsed.data.markets,
          brief: parsed.data.brief,
          claims: parsed.data.claims,
        })
        await refreshDerived(product.id, user.id)
        return c.json({ product }, 201)
      }),
  }),
  registerApiRoute('/app/products/:productId', {
    method: 'GET',
    requiresAuth: false,
    handler: async (c) =>
      withUser(c, async (user) => {
        const workspace = await getWorkspace(c.req.param('productId'), user.id)
        if (!workspace) return c.json({ error: 'Not found' }, 404)
        return c.json(workspace)
      }),
  }),
  registerApiRoute('/app/products/:productId', {
    method: 'PATCH',
    requiresAuth: false,
    handler: async (c) =>
      withUser(c, async (user) => {
        const body = z
          .object({
            name: productNameSchema.optional(),
            brief: z.string().trim().min(1).optional(),
            pinned: z.boolean().optional(),
            archived: z.boolean().optional(),
            claims: z.array(ProductClaimSchema).optional(),
          })
          .refine(
            (value) =>
              value.name !== undefined ||
              value.brief !== undefined ||
              value.pinned !== undefined ||
              value.archived !== undefined ||
              value.claims !== undefined,
          )
          .parse(await c.req.json())

        const productId = c.req.param('productId')
        let workspace = null
        if (body.name !== undefined) {
          workspace = await updateProductName(productId, user.id, body.name)
          if (!workspace) return c.json({ error: 'Not found' }, 404)
        }
        if (body.brief !== undefined) {
          workspace = await updateProductBrief(productId, user.id, body.brief)
          if (!workspace) return c.json({ error: 'Not found' }, 404)
        }
        if (body.pinned !== undefined) {
          workspace = await setProductPinned(productId, user.id, body.pinned)
          if (!workspace) return c.json({ error: 'Not found' }, 404)
        }
        if (body.archived !== undefined) {
          workspace = await setProductArchived(productId, user.id, body.archived)
          if (!workspace) return c.json({ error: 'Not found' }, 404)
        }
        if (body.claims !== undefined) {
          workspace = await updateProductClaims(productId, user.id, body.claims)
          if (!workspace) return c.json({ error: 'Not found' }, 404)
        }
        return c.json({ workspace })
      }),
  }),
  registerApiRoute('/app/products/:productId', {
    method: 'DELETE',
    requiresAuth: false,
    handler: async (c) =>
      withUser(c, async (user) => {
        await deleteProduct(c.req.param('productId'), user.id)
        return c.json({ ok: true })
      }),
  }),
  registerApiRoute('/app/products/:productId/duplicate', {
    method: 'POST',
    requiresAuth: false,
    handler: async (c) =>
      withUser(c, async (user) => {
        const parsed = z
          .object({ name: productNameSchema.optional() })
          .safeParse(await c.req.json().catch(() => ({})))
        if (!parsed.success) return c.json({ error: 'Invalid input' }, 400)
        const product = await duplicateProduct(c.req.param('productId'), user.id, parsed.data.name)
        if (!product) return c.json({ error: 'Not found' }, 404)
        return c.json({ product }, 201)
      }),
  }),
  registerApiRoute('/app/products/:productId/olfactory-pyramid', {
    method: 'PUT',
    requiresAuth: false,
    handler: async (c) =>
      withUser(c, async (user) => {
        const pyramid = z
          .object({
            direction: z.string(),
            top: z.array(z.string()).max(12),
            heart: z.array(z.string()).max(12),
            base: z.array(z.string()).max(12),
          })
          .parse(await c.req.json())
        const workspace = await updateOlfactoryPyramid(
          c.req.param('productId'),
          user.id,
          pyramid,
        )
        if (!workspace) return c.json({ error: 'Product not found' }, 404)
        return c.json({ workspace })
      }),
  }),
  registerApiRoute('/app/products/:productId/formula', {
    method: 'PUT',
    requiresAuth: false,
    handler: async (c) =>
      withUser(c, async (user) => {
        const productId = c.req.param('productId')
        const body = z
          .object({
            variantId: z.string(),
            rows: z.array(FormulaRowSchema),
            expectedVersionId: z.string().nullable(),
          })
          .parse(await c.req.json())
        const versionId = await commitNewVersion(
          productId, body.variantId, user.id, body.rows, body.expectedVersionId,
        )
        const finalWorkspace = await getWorkspace(productId, user.id)
        const isFinal = finalWorkspace?.selectedFinalVariantId === body.variantId
        const derived = isFinal ? await refreshDerived(productId, user.id) : null
        return c.json({
          ok: true,
          versionId,
          workspace: isFinal ? await getWorkspace(productId, user.id) : finalWorkspace,
          ...(derived ?? {}),
        })
      }),
  }),
  registerApiRoute('/app/products/:productId/variants', {
    method: 'POST',
    requiresAuth: false,
    handler: async (c) =>
      withUser(c, async (user) => {
        const productId = c.req.param('productId')
        const body = z
          .object({
            label: z.string().optional(),
            copyFromVariantId: z.string().optional(),
          })
          .parse(await c.req.json())
        const variant = await createVariant(productId, user.id, body)
        if (!variant) return c.json({ error: 'Not found' }, 404)
        const workspace = await getWorkspace(productId, user.id)
        return c.json({ variant, workspace }, 201)
      }),
  }),
  registerApiRoute('/app/products/:productId/variants/:variantId', {
    method: 'PATCH',
    requiresAuth: false,
    handler: async (c) =>
      withUser(c, async (user) => {
        const productId = c.req.param('productId')
        const variantId = c.req.param('variantId')
        const body = z
          .object({
            label: z.string().optional(),
            macerationStartedAt: z.string().nullable().optional(),
            macerationTargetAt: z.string().nullable().optional(),
            macerationNotes: z.string().nullable().optional(),
          })
          .parse(await c.req.json())

        if (body.label) {
          await renameVariant(variantId, productId, user.id, body.label)
        }
        if (
          body.macerationStartedAt !== undefined ||
          body.macerationTargetAt !== undefined ||
          body.macerationNotes !== undefined
        ) {
          try {
            await updateMaceration(variantId, productId, user.id, {
              macerationStartedAt: body.macerationStartedAt,
              macerationTargetAt: body.macerationTargetAt,
              macerationNotes: body.macerationNotes,
            })
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Update failed'
            return c.json({ error: message }, 400)
          }
        }

        const workspace = await getWorkspace(productId, user.id)
        if (!workspace) return c.json({ error: 'Not found' }, 404)
        return c.json({ workspace })
      }),
  }),
  registerApiRoute('/app/products/:productId/variants/:variantId/final', {
    method: 'PATCH',
    requiresAuth: false,
    handler: async (c) =>
      withUser(c, async (user) => {
        try {
          const workspace = await setSelectedFinalVariant(
            c.req.param('productId'),
            c.req.param('variantId'),
            user.id,
          )
          if (!workspace) return c.json({ error: 'Not found' }, 404)
          return c.json({ workspace })
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Cannot set final'
          return c.json({ error: message }, 400)
        }
      }),
  }),
  registerApiRoute('/app/products/:productId/patches/:patchId', {
    method: 'POST',
    requiresAuth: false,
    handler: async (c) =>
      withUser(c, async (user) => {
        const action = z.enum(['accepted', 'rejected']).parse((await c.req.json() as { action: unknown }).action)
        const result = await resolvePatch(
          c.req.param('patchId'),
          c.req.param('productId'),
          user.id,
          action,
        )
        if (!result) return c.json({ error: 'Patch not found' }, 404)
        return c.json(result)
      }),
  }),
  registerApiRoute('/app/proposals', {
    method: 'GET',
    requiresAuth: false,
    handler: async (c) =>
      withUser(c, async (user) => c.json({ proposals: await listPendingProposals(user.id) })),
  }),
  registerApiRoute('/app/proposals/:proposalId', {
    method: 'POST',
    requiresAuth: false,
    handler: async (c) =>
      withUser(c, async (user) => {
        const action = z
          .enum(['accepted', 'rejected'])
          .parse((await c.req.json() as { action: unknown }).action)
        try {
          const result = await resolveProposal(user.id, c.req.param('proposalId'), action)
          if (!result) return c.json({ error: 'Proposal not found' }, 404)
          return c.json(result)
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Could not apply proposal'
          const status = message.includes('already') ? 409 : 400
          return c.json({ error: message }, status)
        }
      }),
  }),
  registerApiRoute('/app/feedback', {
    method: 'POST',
    requiresAuth: false,
    handler: async (c) =>
      withUser(c, async (user) => {
        const parsed = z
          .object({ message: z.string().trim().min(1).max(2000) })
          .safeParse(await c.req.json())
        if (!parsed.success) return c.json({ error: 'Invalid input' }, 400)
        const result = await createFeedback(user.id, parsed.data.message)
        return c.json({ feedback: result }, 201)
      }),
  }),
]

export async function agentGateMiddleware(
  c: {
    req: { header: (name: string) => string | undefined }
    json: (body: unknown, status?: number) => Response
    get: (key: 'requestContext') => AgentRequestContext | undefined
  },
  next: () => Promise<void>,
) {
  const user = await requireUser(c)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)
  if (user.mustChangePassword) {
    return c.json(
      { error: 'Choose a new password before continuing.', code: 'password_change_required' },
      403,
    )
  }
  if (!canUseAssistant(user.plan)) {
    return c.json(
      {
        error: 'Agent requires a paid plan',
        code: 'PLAN_REQUIRED',
        message: 'Upgrade to use the administrative assistant. The notebook and manual editor remain free.',
      },
      402,
    )
  }

  // The client sends its own requestContext in the body, and Mastra has already
  // merged it in by the time we run. Overwrite the identity keys from the verified
  // token so a caller cannot address another person's data by editing the payload.
  const requestContext = c.get('requestContext')
  requestContext?.set('userId', user.id)
  requestContext?.set(MASTRA_RESOURCE_ID_KEY, user.id)

  await next()
}
