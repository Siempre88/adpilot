// AdPilot — Roles de IA.
// Cada feature pide un ROL (ANALYST, CREATIVE_GEN, etc.), no un modelo concreto.
// Cuando cambies de proveedor o modelo, tocas SOLO este archivo.
//
// Estado actual: 100% OpenRouter free tier (costo $0 para beta).
// Post-beta plan: cambiar primaries a Anthropic direct (ver TODOs abajo).

export type AIRole = 'ANALYST' | 'CREATIVE_GEN' | 'CRITIC' | 'FAST' | 'CHEAP'

export type ProviderName = 'anthropic' | 'openrouter'

export interface RoleConfig {
  primary: { provider: ProviderName; model: string }
  fallback: { provider: ProviderName; model: string }
  maxOutputTokens: number
  description: string
}

// ─── ROLE_MAP ───
// TODO post-beta: agregar ANTHROPIC_API_KEY y migrar primaries a:
//   ANALYST.primary      → { provider: 'anthropic', model: 'claude-haiku-4-5-20251001' }
//   CREATIVE_GEN.primary → { provider: 'anthropic', model: 'claude-sonnet-4-6' }
//   CRITIC.primary       → { provider: 'anthropic', model: 'claude-sonnet-4-6' }
//   FAST.primary         → { provider: 'anthropic', model: 'claude-haiku-4-5-20251001' }
//   CHEAP queda con OpenRouter cheap models.

export const ROLE_MAP: Record<AIRole, RoleConfig> = {
  // Chat con tools + voz brutal media buyer.
  // Llama 3.3 70b tiene el mejor tool calling del free tier.
  ANALYST: {
    primary:  { provider: 'openrouter', model: 'meta-llama/llama-3.3-70b-instruct:free' },
    fallback: { provider: 'openrouter', model: 'google/gemini-2.0-flash-exp:free' },
    maxOutputTokens: 1500,
    description: 'Chat especializado, tool calling, multi-turn',
  },

  // Generación JSON estructurada (hooks, copies, headlines, CTAs, scripts UGC).
  // Gemini Flash es rápido y bueno con instrucciones de formato.
  CREATIVE_GEN: {
    primary:  { provider: 'openrouter', model: 'google/gemini-2.0-flash-exp:free' },
    fallback: { provider: 'openrouter', model: 'meta-llama/llama-3.3-70b-instruct:free' },
    maxOutputTokens: 2000,
    description: 'JSON estructurado, escritura creativa en español',
  },

  // Evaluación de creativos: streaming markdown, juicio crítico.
  CRITIC: {
    primary:  { provider: 'openrouter', model: 'meta-llama/llama-3.3-70b-instruct:free' },
    fallback: { provider: 'openrouter', model: 'google/gemini-2.0-flash-exp:free' },
    maxOutputTokens: 1500,
    description: 'Streaming, evaluación honesta y directa',
  },

  // Respuestas rápidas para preguntas simples o status checks.
  FAST: {
    primary:  { provider: 'openrouter', model: 'google/gemini-2.0-flash-exp:free' },
    fallback: { provider: 'openrouter', model: 'meta-llama/llama-3.1-8b-instruct:free' },
    maxOutputTokens: 800,
    description: 'Baja latencia, preguntas simples',
  },

  // Batch operations: tagging, summarization, jobs offline.
  CHEAP: {
    primary:  { provider: 'openrouter', model: 'meta-llama/llama-3.1-8b-instruct:free' },
    fallback: { provider: 'openrouter', model: 'google/gemini-2.0-flash-exp:free' },
    maxOutputTokens: 600,
    description: 'Volumen alto, calidad media, costo mínimo',
  },
}
