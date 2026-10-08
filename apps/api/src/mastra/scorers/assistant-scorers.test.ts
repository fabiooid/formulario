import { describe, expect, it } from 'vitest'
import { createAgentTestRun, createTestMessage } from '@mastra/evals/scorers/utils'
import {
  formulationBoundaryScorer,
  honestCompletionScorer,
  pointsToConnections,
  toolErrorsScorer,
} from './assistant-scorers.js'

type Invocation = { toolName: string; result: Record<string, unknown> }

function reply(content: string, tools: Invocation[] = []) {
  return createAgentTestRun({
    inputMessages: [createTestMessage({ content: 'question', role: 'user' })],
    output: [
      createTestMessage({
        content,
        role: 'assistant',
        toolInvocations: tools.map((tool, index) => ({
          toolCallId: `call-${index}`,
          toolName: tool.toolName,
          args: {},
          result: tool.result,
          state: 'result',
        })),
      }),
    ],
  })
}

const drafted = 'Try Squalane 70%, Jojoba 25%, Tocopherol 5%.'

describe('formulation boundary', () => {
  it('fails a formula drafted in chat', async () => {
    expect((await formulationBoundaryScorer.run(reply(drafted))).score).toBe(0)
  })

  it('passes percentages read from a saved formula', async () => {
    const run = reply(drafted, [{ toolName: 'get_formula', result: { rows: [] } }])
    expect((await formulationBoundaryScorer.run(run)).score).toBe(1)
  })

  it('passes an ordinary answer', async () => {
    expect((await formulationBoundaryScorer.run(reply('You have 3 products.'))).score).toBe(1)
  })
})

describe('honest completion', () => {
  it('fails a completion claim after only a pending proposal', async () => {
    const run = reply("I've added Squalane to your stock.", [
      { toolName: 'propose_inventory_change', result: { status: 'pending', proposalId: 'p1' } },
    ])
    const result = await honestCompletionScorer.run(run)
    expect(result.score).toBe(0)
    expect(result.reason).toContain('pending card')
  })

  it('fails a claim with no tool at all, in Italian', async () => {
    expect((await honestCompletionScorer.run(reply('Il prodotto è stato duplicato.'))).score).toBe(0)
  })

  it('passes a claim the tool confirmed', async () => {
    const run = reply('The product has been duplicated.', [
      { toolName: 'duplicate_product', result: { status: 'completed', productId: 'x' } },
    ])
    expect((await honestCompletionScorer.run(run)).score).toBe(1)
  })

  it('passes a correctly described proposal', async () => {
    const run = reply('I proposed adding Squalane. Accept the card to save it.', [
      { toolName: 'propose_inventory_change', result: { status: 'pending' } },
    ])
    expect((await honestCompletionScorer.run(run)).score).toBe(1)
  })
})

describe('tool errors', () => {
  it('scores the share of tool calls that succeeded', async () => {
    const run = reply('Done reading.', [
      { toolName: 'get_inventory', result: { items: [] } },
      { toolName: 'get_product', result: { error: 'Product not found' } },
    ])
    const result = await toolErrorsScorer.run(run)
    expect(result.score).toBe(0.5)
    expect(result.reason).toBe('Failed: get_product.')
  })

  it('scores 1 when no tool was called', async () => {
    expect((await toolErrorsScorer.run(reply('Hello.'))).score).toBe(1)
  })
})

describe('points to connections', () => {
  it('needs both the external assistant and Settings → Connections', () => {
    expect(pointsToConnections('Connect ChatGPT or Claude from Settings → Connections.')).toBe(true)
    expect(pointsToConnections('Collega il tuo assistente esterno da Impostazioni → Connessioni.')).toBe(true)
    expect(pointsToConnections("I can't create formulations.")).toBe(false)
    expect(pointsToConnections('Use your external assistant for that.')).toBe(false)
  })
})
