import type { Plan } from './types.ts'

// V1: every account gets the Lab Assistant. Flip to true when paid plans launch;
// the API gate, the chat pane and Settings → Plan all follow this switch.
export const ASSISTANT_REQUIRES_PAID_PLAN = false

export function canUseAssistant(plan: Plan) {
  return !ASSISTANT_REQUIRES_PAID_PLAN || plan === 'paid'
}
