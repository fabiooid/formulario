import { describe, expect, it } from 'vitest'
import { decideApiGate, decideStudioPageGate } from './api-gate.js'

describe('decideApiGate', () => {
  it('always routes the Lab Assistant stream through the agent gate', () => {
    expect(decideApiGate('/api/agents/assistantAgent/stream', false)).toBe('agent_gate')
    expect(decideApiGate('/api/agents/assistantAgent/stream', true)).toBe('agent_gate')
  })

  it('404s other framework APIs when Studio is off', () => {
    expect(decideApiGate('/api/agents', false)).toBe('not_found')
    expect(decideApiGate('/api/tools', false)).toBe('not_found')
    expect(decideApiGate('/api/mcp/v0/formulario', false)).toBe('not_found')
  })

  it('opens framework APIs when Studio is on (server.auth gates them)', () => {
    expect(decideApiGate('/api/agents', true)).toBe('next')
    expect(decideApiGate('/api/tools', true)).toBe('next')
  })
})

describe('decideStudioPageGate', () => {
  it('404s Studio pages when the flag is off', () => {
    expect(decideStudioPageGate(false)).toBe('not_found')
  })

  it('allows Studio pages when the flag is on', () => {
    expect(decideStudioPageGate(true)).toBe('next')
  })
})
