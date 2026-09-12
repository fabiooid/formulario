import { beforeEach, describe, expect, it, vi } from 'vitest'
import { noopObserve } from '@mastra/core/tools'
import { RequestContext } from '@mastra/core/request-context'

const generate = vi.hoisted(() => vi.fn())
vi.mock('../agents/formulator-agent.js', () => ({ formulatorAgent: { generate } }))

import { delegateFormulationTool } from './delegate-formulation.js'
import { assistantTools } from './assistant-tools.js'
import { formulatorTools } from './formulator-tools.js'

function context() {
  const requestContext = new RequestContext()
  requestContext.set('userId', 'verified-user')
  requestContext.set('productId', 'open-product')
  requestContext.set('variantId', 'open-variant')
  requestContext.set('mastra__threadId', 'parent-thread')
  return { requestContext, observe: noopObserve, abortSignal: new AbortController().signal }
}

beforeEach(() => generate.mockReset().mockResolvedValue({ text: 'Assessment with evidence.' }))

describe('formulation delegation', () => {
  it('forwards identity, screen and cancellation but not parent memory; review cannot propose', async () => {
    const parent = context()
    await delegateFormulationTool.execute!({ mode: 'review', brief: 'Critique this formula', newProduct: false }, parent)
    const options = generate.mock.calls[0][1]
    expect(options.requestContext.get('userId')).toBe('verified-user')
    expect(options.requestContext.get('productId')).toBe('open-product')
    expect(options.requestContext.get('variantId')).toBe('open-variant')
    expect(options.requestContext.get('mastra__threadId')).toBeUndefined()
    expect(options.abortSignal).toBe(parent.abortSignal)
    expect(options.activeTools).toContain('get_formula')
    expect(options.activeTools).not.toContain('propose_formula_patch')
    expect(options.activeTools).not.toContain('propose_product')
  })

  it('does not carry the open variant to a different product', async () => {
    await delegateFormulationTool.execute!({ mode: 'revise', brief: 'Make the other product lighter', productId: 'other', newProduct: false }, context())
    const options = generate.mock.calls[0][1]
    expect(options.requestContext.get('productId')).toBe('other')
    expect(options.requestContext.get('variantId')).toBeUndefined()
    expect(options.activeTools).toContain('propose_formula_patch')
  })

  it('clears screen context for a new product and allows one full product proposal', async () => {
    await delegateFormulationTool.execute!({ mode: 'create', brief: 'Create a cream', newProduct: true }, context())
    const options = generate.mock.calls[0][1]
    expect(options.requestContext.get('productId')).toBeUndefined()
    expect(options.requestContext.get('variantId')).toBeUndefined()
    expect(options.activeTools).toContain('propose_product')
    expect(generate).toHaveBeenCalledTimes(1)
  })

  it('fails before delegation without an authenticated user', async () => {
    await expect(delegateFormulationTool.execute!({ mode: 'review', brief: 'Review', newProduct: false }, { requestContext: new RequestContext(), observe: noopObserve })).rejects.toThrow('Missing user context')
    expect(generate).not.toHaveBeenCalled()
  })

  it('does not grant formula-writing tools to the assistant or admin writes to the specialist', () => {
    expect(assistantTools).not.toHaveProperty('propose_formula_patch')
    expect(assistantTools).not.toHaveProperty('propose_product')
    expect(formulatorTools).not.toHaveProperty('propose_inventory_change')
    expect(formulatorTools).not.toHaveProperty('duplicate_product')
  })
})
