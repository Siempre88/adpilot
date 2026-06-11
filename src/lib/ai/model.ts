// AdPilot — API pública del AI layer.
// Las features piden ROLES, no modelos. Cuando cambias de proveedor o modelo,
// solo tocas roles.ts.
//
// Uso:
//   import { getModel, getFallbackModel, getRoleConfig } from '@/lib/ai/model'
//   const result = streamText({ model: getModel('ANALYST'), ... })
//   catch → const result = streamText({ model: getFallbackModel('ANALYST'), ... })

import { getAnthropicProvider } from './providers/anthropic'
import { getOpenRouterProvider } from './providers/openrouter'
import { ROLE_MAP, type AIRole, type ProviderName, type RoleConfig } from './roles'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildModel(provider: ProviderName, modelId: string): any {
  switch (provider) {
    case 'anthropic':
      return getAnthropicProvider()(modelId)
    case 'openrouter':
      return getOpenRouterProvider()(modelId)
  }
}

/**
 * Modelo PRIMARIO del rol. Es el primer intento.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getModel(role: AIRole): any {
  const cfg = ROLE_MAP[role]
  console.log(`[AI] ${role} → ${cfg.primary.provider}:${cfg.primary.model}`)
  return buildModel(cfg.primary.provider, cfg.primary.model)
}

/**
 * Modelo FALLBACK del rol. Para reintento cuando el primario falla.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getFallbackModel(role: AIRole): any {
  const cfg = ROLE_MAP[role]
  console.log(`[AI] ${role} FALLBACK → ${cfg.fallback.provider}:${cfg.fallback.model}`)
  return buildModel(cfg.fallback.provider, cfg.fallback.model)
}

/**
 * Config completa del rol (maxOutputTokens, descripciones, etc.)
 */
export function getRoleConfig(role: AIRole): RoleConfig {
  return ROLE_MAP[role]
}

export type { AIRole }
