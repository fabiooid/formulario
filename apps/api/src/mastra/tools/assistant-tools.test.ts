import { describe, expect, it } from 'vitest'
import { noopObserve } from '@mastra/core/tools'
import { RequestContext } from '@mastra/core/request-context'
import { assistantTools, getToolContext } from './assistant-tools.js'

describe('Lab Assistant tools', () => {
  it('stay administrative and cannot write formulas', () => {
    expect(Object.keys(assistantTools).sort()).toEqual([
      'duplicate_product',
      'get_formula',
      'get_home',
      'get_inventory',
      'get_product',
      'list_products',
      'propose_empty_product',
      'propose_inventory_change',
    ])
  })

  it('refuse to run without an authenticated user', () => {
    expect(() => getToolContext({ requestContext: new RequestContext(), observe: noopObserve })).toThrow('Missing user context')
  })
})
