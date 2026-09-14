import { Agent } from '@mastra/core/agent'
import { getProductForUser } from '../../services/products.js'
import { agentModel } from './model.js'
import { formulatorLiveScorers } from '../scorers/formulator-scorers.js'
import { formulatorTools } from '../tools/formulator-tools.js'

import { FORMULATOR_INSTRUCTIONS as INSTRUCTIONS } from './formulator-instructions.js'

async function instructionsForScreen({
  requestContext,
}: {
  requestContext: { get: (key: string) => unknown }
}) {
  const userId = requestContext.get('userId')
  const productId = requestContext.get('productId')
  let screen =
    'No product is open. The person can still ask about stock, any product, or start a new one.'
  if (typeof userId === 'string' && typeof productId === 'string' && productId) {
    const product = await getProductForUser(productId, userId)
    if (product) {
      screen = `The person is looking at "${product.name}". Stay on that product unless they ask about another product, stock, or the whole atelier.`
    }
  }
  return `${INSTRUCTIONS}\nOn screen:\n- ${screen}`
}

export const formulatorAgent = new Agent({
  id: 'formulatorAgent',
  name: 'Formulator Agent',
  instructions: instructionsForScreen,
  model: agentModel(),
  tools: formulatorTools,
  scorers: formulatorLiveScorers,
  // Drafting is a loop: guide → propose → (rejected → fix → propose). The default step
  // budget is too small for that, so give it room to repair a draft before it gives up.
  defaultOptions: {
    maxSteps: 18,
  },
})
