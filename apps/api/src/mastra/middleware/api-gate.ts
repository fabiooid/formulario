/**
 * Decide how Formulario treats Mastra framework `/api/*` routes.
 * Studio off → keep the public surface closed (404). Studio on → Mastra `server.auth`.
 * The Lab Assistant stream always goes through the Formulario agent gate.
 */
export type ApiGateDecision = 'not_found' | 'agent_gate' | 'next'

export function decideApiGate(path: string, studioEnabled: boolean): ApiGateDecision {
  if (path === '/api/agents/assistantAgent/stream') return 'agent_gate'
  if (!studioEnabled) return 'not_found'
  return 'next'
}

export function decideStudioPageGate(studioEnabled: boolean): 'not_found' | 'next' {
  return studioEnabled ? 'next' : 'not_found'
}
