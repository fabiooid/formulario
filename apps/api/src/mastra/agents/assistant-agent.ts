import { Agent } from '@mastra/core/agent'
import { Memory } from '@mastra/memory'
import { agentModel } from './model.js'
import { assistantTools } from '../tools/assistant-tools.js'
import { assistantLiveScorers } from '../scorers/assistant-scorers.js'
import { ASSISTANT_INSTRUCTIONS } from './assistant-instructions.js'

export const assistantAgent = new Agent({
  id: 'assistantAgent',
  name: 'Formulario Assistant',
  model: agentModel(),
  instructions: ASSISTANT_INSTRUCTIONS,
  tools: assistantTools,
  scorers: assistantLiveScorers,
  defaultOptions: { maxSteps: 12 },
  memory: new Memory({ options: { lastMessages: 30 } }),
})
