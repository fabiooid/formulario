import { createScorer } from '@mastra/core/evals'
import { createAnswerRelevancyScorer } from '@mastra/evals/scorers/prebuilt'
import { extractToolCalls, getAssistantMessageFromRunOutput } from '@mastra/evals/scorers/utils'
import { applyLocalEnv } from '../load-env.js'

applyLocalEnv()


const PROPOSAL_TOOLS = new Set(['propose_formula_patch', 'propose_product'])

function judgeModel() {
  const provider = process.env.FORMULATOR_PROVIDER?.trim().toLowerCase()
  const geminiKey = process.env.GEMINI_API_KEY?.trim()
  const openaiKey = process.env.OPENAI_API_KEY?.trim()
  const gemini = (process.env.GEMINI_MODEL?.trim() || 'google/gemini-3.6-flash') as `${string}/${string}`
  const openai = (process.env.OPENAI_MODEL?.trim() || 'openai/gpt-4o-mini') as `${string}/${string}`
  const preferOpenai = provider === 'openai' ? Boolean(openaiKey) : !geminiKey && Boolean(openaiKey)
  if (preferOpenai && openaiKey) return openai
  if (geminiKey) return gemini
  return openai
}

export const formulaOnCardScorer = createScorer({
  id: 'formula-on-card',
  name: 'Formula on card',
  description: 'Formula drafts go through a proposal tool instead of being dumped as percents in chat.',
  type: 'agent',
})
  .generateScore(({ run }) => {
    const text = getAssistantMessageFromRunOutput(run.output) ?? ''
    const { tools } = extractToolCalls(run.output)
    const proposed = tools.some((name) => PROPOSAL_TOOLS.has(name))
    const dumped = (text.match(/\d+(?:\.\d+)?\s*%/g) ?? []).length >= 3
    if (dumped && !proposed) return 0
    return 1
  })
  .generateReason(({ score }) => {
    if (score === 1) return 'Formula stayed off the chat bubble, or no formula was dumped.'
    return 'Reply listed several percents in chat instead of using a proposal tool.'
  })

export const answerRelevancyScorer = createAnswerRelevancyScorer({
  model: judgeModel(),
})

export const formulatorScorers = {
  formulaOnCard: formulaOnCardScorer,
  answerRelevancy: answerRelevancyScorer,
}

const live = { type: 'ratio' as const, rate: 1 }

export const formulatorLiveScorers = {
  formulaOnCard: { scorer: formulatorScorers.formulaOnCard, sampling: live },
  answerRelevancy: { scorer: formulatorScorers.answerRelevancy, sampling: live },
}
