// AdPilot — Analyst types.
// Chat client-side. La API streamea respuestas; los tools devuelven JSON desde Supabase.

export type ChatRole = 'user' | 'assistant'

export interface ChatMessage {
  id: string
  role: ChatRole
  content: string
}

// Cuando no hay datos para responder (precheck antes de invocar LLM)
export interface AnalystEmpty {
  state: 'empty'
  reason: 'no_meta' | 'no_sync'
  message: string
  cta: { label: string; action: 'connect_meta' | 'sync' }
}

// Sugerencias rápidas que se muestran al abrir /analyst
export interface QuickSuggestion {
  label: string
  prompt: string
}

// Snapshot ligero del estado de la cuenta que se inyecta al system prompt
// para que el modelo arranque con contexto sin necesidad de un tool call inicial.
export interface AccountSnapshot {
  total_active_campaigns: number
  winners: number
  at_risk: number
  losers: number
  pending_actions: number
  avoidable_loss_per_day: number
  revenue_opportunity_per_day: number
  last_sync: string | null
}
