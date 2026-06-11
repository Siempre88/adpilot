// AdPilot — Anthropic provider client.
// Cliente directo (no via OpenRouter). Soporta tool calling estable y
// prompt caching nativo. Usado para roles críticos: Analyst, CreativeGen, Critic.

import { createAnthropic } from '@ai-sdk/anthropic'

let _client: ReturnType<typeof createAnthropic> | null = null

export function getAnthropicProvider() {
  if (_client) return _client
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    throw new Error(
      'ANTHROPIC_API_KEY no está configurada. Agrégala en .env.local. ' +
      'Crea una en https://console.anthropic.com (te dan $5 de crédito gratis).'
    )
  }
  _client = createAnthropic({ apiKey })
  return _client
}
