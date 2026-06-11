// AdPilot — Clasificación mínima de errores LLM.
// Decide si conviene reintentar con fallback o devolver al usuario.

export function isRetryableLLMError(e: unknown): boolean {
  if (!(e instanceof Error)) return false
  const msg = e.message.toLowerCase()
  return (
    msg.includes('rate limit') ||
    msg.includes('timeout') ||
    msg.includes('overloaded') ||
    msg.includes('503') ||
    msg.includes('502') ||
    msg.includes('504') ||
    msg.includes('429') ||
    msg.includes('econnreset') ||
    msg.includes('etimedout') ||
    msg.includes('provider returned error')
  )
}

export function isAuthError(e: unknown): boolean {
  if (!(e instanceof Error)) return false
  const msg = e.message.toLowerCase()
  return msg.includes('401') || msg.includes('unauthorized') || msg.includes('invalid api key')
}
