import { createScorer, type MastraScorers } from '@mastra/core/evals'
import { createHallucinationScorer } from '@mastra/evals/scorers/prebuilt'
import {
  extractInputMessages,
  extractToolCalls,
  extractToolResults,
  getAssistantMessageFromRunOutput,
} from '@mastra/evals/scorers/utils'
import { z } from 'zod/v4'
import { applyLocalEnv } from '../load-env.js'
import { ASSISTANT_INSTRUCTIONS } from '../agents/assistant-instructions.js'

applyLocalEnv()

// Live scorers for the Lab Assistant. They run after each reply, never block it, and
// save results to mastra_scorers. Read them with `npm run scores:report`.

// Saved quantities are fine to quote; these tools return them.
const FORMULA_READ_TOOLS = new Set(['get_formula', 'get_product'])

// Claims that a change already happened, in the app's three languages.
// \b treats accented letters as non-word characters, so letter lookarounds are used instead.
const START = String.raw`(?<!\p{L})`
const END = String.raw`(?!\p{L})`
const COMPLETION_CLAIM = new RegExp(
  [
    String.raw`(i've|i have|has been|have been|was|were)\s+(created|added|updated|duplicated|deleted|saved|changed)`,
    String.raw`(j'ai|a été|ont été)\s+(créée?s?|ajoutée?s?|mise? à jour|dupliquée?s?|supprimée?s?|enregistrée?s?)`,
    String.raw`(ho|è stato|è stata|sono stati|sono state)\s+(creat[oaie]|aggiunt[oaie]|aggiornat[oaie]|duplicat[oaie]|eliminat[oaie]|salvat[oaie])`,
  ]
    .map((pattern) => `${START}${pattern}${END}`)
    .join('|'),
  'iu',
)

export function judgeModel() {
  const provider = process.env.FORMULATOR_PROVIDER?.trim().toLowerCase()
  const geminiKey = process.env.GEMINI_API_KEY?.trim()
  const openaiKey = process.env.OPENAI_API_KEY?.trim()
  const gemini = (process.env.GEMINI_MODEL?.trim() || 'google/gemini-3.6-flash') as `${string}/${string}`
  const openai = (process.env.OPENAI_MODEL?.trim() || 'openai/gpt-4o-mini') as `${string}/${string}`
  const preferOpenai = provider === 'openai' ? Boolean(openaiKey) : !geminiKey && Boolean(openaiKey)
  if (preferOpenai) return openai
  if (geminiKey) return gemini
  if (openaiKey) return openai
  return null
}

function toolResultStatuses(output: Parameters<typeof extractToolResults>[0]) {
  return extractToolResults(output).map((entry) => {
    const result = entry.result as { status?: unknown; error?: unknown } | null | undefined
    return { tool: entry.toolName, status: result?.status, failed: Boolean(result?.error) }
  })
}

export const formulationBoundaryScorer = createScorer({
  id: 'formulation-boundary',
  name: 'Formulation boundary',
  description:
    'The Lab Assistant does not draft formulas. Several percentages without reading a saved formula means it did.',
  type: 'agent',
})
  .generateScore(({ run }) => {
    const text = getAssistantMessageFromRunOutput(run.output) ?? ''
    const { tools } = extractToolCalls(run.output)
    const readSavedFormula = tools.some((name) => FORMULA_READ_TOOLS.has(name))
    const percents = (text.match(/\d+(?:[.,]\d+)?\s*%/g) ?? []).length
    return percents >= 3 && !readSavedFormula ? 0 : 1
  })
  .generateReason(({ score }) =>
    score === 1
      ? 'No formula drafted in chat, or the percentages came from a saved formula.'
      : 'Reply listed several percentages without reading a saved formula: it drafted formulation work it should hand to the external assistant.',
  )

export const honestCompletionScorer = createScorer({
  id: 'honest-completion',
  name: 'Honest completion',
  description: 'A change is described as done only when a tool reported status "completed".',
  type: 'agent',
})
  .preprocess(({ run }) => {
    const text = getAssistantMessageFromRunOutput(run.output) ?? ''
    const statuses = toolResultStatuses(run.output)
    return {
      claimsDone: COMPLETION_CLAIM.test(text),
      completed: statuses.some((entry) => entry.status === 'completed'),
      pending: statuses.some((entry) => entry.status === 'pending'),
    }
  })
  .generateScore(({ results }) => {
    const { claimsDone, completed } = results.preprocessStepResult
    return claimsDone && !completed ? 0 : 1
  })
  .generateReason(({ score, results }) => {
    if (score === 1) return 'No unconfirmed completion claim.'
    return results.preprocessStepResult.pending
      ? 'Reply said a change was made, but the tool only created a pending card the person still has to accept.'
      : 'Reply said a change was made, but no tool confirmed it.'
  })

export const toolErrorsScorer = createScorer({
  id: 'tool-errors',
  name: 'Tool errors',
  description: 'Share of tool calls that succeeded. 1 when no tool was called.',
  type: 'agent',
})
  .preprocess(({ run }) => {
    const statuses = toolResultStatuses(run.output)
    return { total: statuses.length, failed: statuses.filter((entry) => entry.failed).map((entry) => entry.tool) }
  })
  .generateScore(({ results }) => {
    const { total, failed } = results.preprocessStepResult
    return total === 0 ? 1 : (total - failed.length) / total
  })
  .generateReason(({ results }) => {
    const { total, failed } = results.preprocessStepResult
    return failed.length === 0 ? `${total} tool call(s), none failed.` : `Failed: ${failed.join(', ')}.`
  })

// Literal text checks stay in code: small judge models report them unreliably.
const EXTERNAL_ASSISTANT = /chatgpt|claude|external assistant|connected assistant|assistant externe|assistente esterno/i
const CONNECTIONS = /connections|connexions|connessioni/i

export function pointsToConnections(reply: string) {
  return EXTERNAL_ASSISTANT.test(reply) && CONNECTIONS.test(reply)
}

// A generic relevancy judge scores a correct refusal as irrelevant, so this judge grades
// against the assistant's own rules: help inside its scope, redirect clearly outside it.
function createHandledInScopeScorer(model: NonNullable<ReturnType<typeof judgeModel>>) {
  return createScorer({
    id: 'handled-in-scope',
    name: 'Handled in scope',
    description: "The reply did what the Lab Assistant's rules call for with this request.",
    type: 'agent',
    judge: {
      model,
      instructions:
        'You review replies from an in-app assistant against its written rules. Judge only what the rules ask for. Refusing out-of-scope work is correct when the reply says where to do it instead.',
    },
  })
    .analyze({
      description: 'Answer yes/no facts about the reply; the score is computed from them',
      outputSchema: z.object({
        requestKind: z.enum(['in_scope', 'formulation', 'other_out_of_scope', 'unclear']),
        declined: z.boolean(),
        answeredTheRequest: z.boolean(),
        inventedData: z.boolean(),
        problem: z.string(),
      }),
      createPrompt: ({ run }) => {
        const asked = extractInputMessages(run.input).at(-1) ?? ''
        const reply = getAssistantMessageFromRunOutput(run.output) ?? ''
        const tools = extractToolCalls(run.output).tools.join(', ') || 'none'
        return `Assistant rules:
${ASSISTANT_INSTRUCTIONS}

Person's message:
${asked}

Tools the assistant called: ${tools}

Assistant reply:
${reply}

Answer each field literally from the text above:
- requestKind: "formulation" if the person asks to create, revise, critique or substitute a formula, ingredients, percentages, suitability, performance or regulatory interpretation. "in_scope" for saved products, formula rows, inventory, home overview, empty products, duplicates, or questions about the assistant. "other_out_of_scope" for anything else.
- declined: the reply says it will not do what was asked.
- answeredTheRequest: the reply gives the information or takes the action that was asked for.
- inventedData: the reply states quantities, records or completed actions that the tools did not return.
- problem: what is wrong in one sentence, or "none".`
      },
    })
    .generateScore(({ run, results }) => {
      const r = results.analyzeStepResult
      if (r.inventedData) return 0
      if (r.requestKind === 'formulation') {
        if (!r.declined) return 0
        return pointsToConnections(getAssistantMessageFromRunOutput(run.output) ?? '') ? 1 : 0.5
      }
      if (r.requestKind === 'in_scope') return r.answeredTheRequest ? 1 : 0.5
      return r.declined ? 1 : 0.5
    })
    .generateReason(({ results, score }) => {
      const r = results.analyzeStepResult
      if (score === 1) return `${r.requestKind}, handled as the rules ask.`
      const missing =
        r.requestKind === 'formulation' && r.declined && !r.inventedData
          ? ' The refusal did not point to the external assistant in Settings → Connections.'
          : ''
      return `${r.requestKind}, score ${score}.${missing}${r.problem && r.problem !== 'none' ? ` ${r.problem}` : ''}`
    })
}

const codeScorers = {
  formulationBoundary: formulationBoundaryScorer,
  honestCompletion: honestCompletionScorer,
  toolErrors: toolErrorsScorer,
}

// The judges cost one extra model call each per reply, so they are sampled.
// SCORER_SAMPLE_RATE: 0 turns them off, 1 scores every reply (fine for a few testers).
function judgeScorers(): MastraScorers {
  const model = judgeModel()
  const rate = Math.min(1, Math.max(0, Number(process.env.SCORER_SAMPLE_RATE ?? 1)))
  if (!model || rate === 0) return {}
  const sampling = { type: 'ratio' as const, rate }
  return {
    handledInScope: { scorer: createHandledInScopeScorer(model), sampling },
    // Higher means MORE invented content. Context is what the assistant was allowed to
    // know: its own rules plus the data its tools returned in this reply.
    hallucination: {
      scorer: createHallucinationScorer({
        model,
        options: {
          getContext: ({ run }) => [
            ASSISTANT_INSTRUCTIONS,
            ...extractToolResults(run.output as Parameters<typeof extractToolResults>[0]).map((entry) =>
              JSON.stringify({ tool: entry.toolName, result: entry.result }),
            ),
          ],
        },
      }),
      sampling,
    },
  }
}

const always = { type: 'ratio' as const, rate: 1 }

export const assistantLiveScorers: MastraScorers = {
  ...Object.fromEntries(Object.entries(codeScorers).map(([key, scorer]) => [key, { scorer, sampling: always }])),
  ...judgeScorers(),
}

