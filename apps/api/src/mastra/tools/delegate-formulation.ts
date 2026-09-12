import { createTool } from '@mastra/core/tools'
import { RequestContext } from '@mastra/core/request-context'
import { z } from 'zod'
import { formulatorAgent } from '../agents/formulator-agent.js'
import { formulatorTools, getToolContext } from './formulator-tools.js'

export const formulationReadTools = [
  'list_products', 'get_product', 'get_formula', 'get_inventory',
  'get_formulation_guide', 'search_materials', 'get_material_evidence',
  'run_regulatory_check', 'search_ingredient_rules',
]

export const delegateFormulationTool = createTool({
  id: 'delegate_formulation',
  description: 'Ask the formulation specialist to create, revise, review or critique a formula. Include the full request, relevant prior decisions, exclusions, and constraints. Review is read-only. For a new product with a formula, delegate once and let the specialist create one complete proposal.',
  inputSchema: z.object({
    mode: z.enum(['create', 'revise', 'review']),
    brief: z.string().trim().min(1),
    productId: z.string().min(1).optional(),
    variantId: z.string().min(1).optional(),
    newProduct: z.boolean().default(false),
  }).strict(),
  execute: async (input, context) => {
    const screen = getToolContext(context)
    // Never inherit the parent's memory/thread keys. Each specialist invocation
    // gets a focused brief and reads authoritative product data through its tools.
    const requestContext = new RequestContext()
    requestContext.set('userId', screen.userId)
    if (!input.newProduct) {
      const productId = input.productId ?? screen.productId
      const variantId = input.variantId ?? (productId === screen.productId ? screen.variantId : undefined)
      if (productId) requestContext.set('productId', productId)
      if (variantId) requestContext.set('variantId', variantId)
    }
    const result = await formulatorAgent.generate(
      `Task: ${input.mode}. ${input.newProduct ? 'This is a NEW product, not the open product.' : 'Read the relevant saved product and formula before assessing or revising it.'}\n\n${input.brief}`,
      {
        requestContext,
        abortSignal: context?.abortSignal,
        maxSteps: 18,
        activeTools: input.mode === 'review' ? formulationReadTools : Object.keys(formulatorTools),
      },
    )
    if (!result.text.trim()) throw new Error('The formulation specialist did not return an assessment. Check pending proposals before retrying.')
    return { mode: input.mode, response: result.text }
  },
})
