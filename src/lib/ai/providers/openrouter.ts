// AdPilot — OpenRouter provider client.
// Usado como fallback (otro proveedor cuando el primario tiene incidente)
// y para experimentación. NO recomendado como primario para roles críticos.

import { createOpenRouter } from '@openrouter/ai-sdk-provider'

let _client: ReturnType<typeof createOpenRouter> | null = null

export function getOpenRouterProvider() {
  if (_client) return _client
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY no está configurada en .env.local')
  }
  _client = createOpenRouter({ apiKey })
  return _client
}
