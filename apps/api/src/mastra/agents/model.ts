import dns from 'node:dns'
import net from 'node:net'
import { applyLocalEnv } from '../load-env.js'

applyLocalEnv()
dns.setDefaultResultOrder('ipv4first')
net.setDefaultAutoSelectFamily(false)

/**
 * Primary model plus a fallback. Drafting a full formula takes several long steps, so a
 * rate limit or a busy provider must not end the run: each entry retries with backoff,
 * and when one provider is down the other takes over.
 */
export function agentModel() {
  const provider = process.env.FORMULATOR_PROVIDER?.trim().toLowerCase()
  const geminiKey = process.env.GEMINI_API_KEY?.trim()
  const openaiKey = process.env.OPENAI_API_KEY?.trim()
  const retries = Number(process.env.FORMULATOR_MAX_RETRIES ?? 4)
  type ModelId = `${string}/${string}`
  const gemini = {
    id: (process.env.GEMINI_MODEL?.trim() || 'google/gemini-3.6-flash') as ModelId,
    apiKey: geminiKey,
  }
  const openai = {
    id: (process.env.OPENAI_MODEL?.trim() || 'openai/gpt-4o-mini') as ModelId,
    apiKey: openaiKey,
  }

  const preferOpenai = provider === 'openai' ? Boolean(openaiKey) : !geminiKey && Boolean(openaiKey)
  const ordered = preferOpenai ? [openai, gemini] : [gemini, openai]
  const available = ordered.filter((entry) => entry.apiKey)

  if (available.length === 0) {
    console.log(`[formulario] formulator model: ${gemini.id} (no key set)`)
    return gemini.id
  }

  console.log(`[formulario] formulator model: ${available.map((entry) => entry.id).join(' → ')}`)
  return available.map((entry) => ({ model: entry, maxRetries: retries }))
}

