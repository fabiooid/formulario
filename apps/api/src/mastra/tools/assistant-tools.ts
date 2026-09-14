import { createTool } from '@mastra/core/tools'
import { z } from 'zod'
import { duplicateProduct } from '../../services/products.js'
import {
  getToolContext, listProductsTool, getProductTool, getFormulaTool,
  getInventoryTool, getHomeTool, proposeInventoryChangeTool, proposeProductTool,
} from './formulator-tools.js'

// The assistant cannot smuggle a composition through the product-creation tool.
export const proposeEmptyProductTool = createTool({
  id: 'propose_empty_product',
  description: 'Propose a new product without a formula. The person accepts the existing product card. Formulation is available through a connected external assistant; this tool never creates formula rows.',
  inputSchema: z.object({
    summary: z.string(),
    name: z.string().trim().min(1).max(120),
    type: z.enum(['skincare', 'perfume', 'hybrid']),
    brief: z.string().min(1),
    markets: z.array(z.enum(['EU', 'UK', 'US', 'HK', 'ASEAN'])).optional(),
    claims: z.array(z.enum(['vegan', 'natural', 'organic'])).optional(),
  }).strict(),
  execute: async (input, context) => proposeProductTool.execute!(input, context),
})

export const duplicateProductTool = createTool({
  id: 'duplicate_product',
  description: 'Copy a product and its saved variants exactly using the same operation as the UI. Executes immediately, only when the person requests a copy. Resolve the source with get_product first. Does not redesign the formula.',
  inputSchema: z.object({
    productId: z.string().min(1),
    name: z.string().trim().min(1).max(120).optional(),
  }).strict(),
  execute: async ({ productId, name }, context) => {
    const { userId } = getToolContext(context)
    const product = await duplicateProduct(productId, userId, name)
    if (!product) return { error: 'Product not found' }
    return { status: 'completed', productId: product.id, name: product.name }
  },
})

export const assistantTools = {
  list_products: listProductsTool,
  get_product: getProductTool,
  get_formula: getFormulaTool,
  get_inventory: getInventoryTool,
  get_home: getHomeTool,
  propose_inventory_change: proposeInventoryChangeTool,
  propose_empty_product: proposeEmptyProductTool,
  duplicate_product: duplicateProductTool,
}
