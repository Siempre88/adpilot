// AdPilot — Creative Lab: prompt para scripts UGC (15-30s).
// User-Generated Content: tono natural, primera persona, como video casero.

import type { CreativeAngle, CreativeDiagnosis } from '../types'

export interface UgcScriptPromptInput {
  diagnosis: CreativeDiagnosis
  angle: CreativeAngle
  campaign_objective?: string
}

export function buildUgcScriptPrompt(input: UgcScriptPromptInput): string {
  const d = input.diagnosis
  const anglePart = input.angle === 'auto'
    ? 'Cada script con un ángulo distinto: uno de prueba social y otro de antes/después.'
    : `Ambos scripts con el ángulo: ${input.angle}.`

  return `Eres un creador de contenido UGC (user-generated content) experimentado en performance ads. Escribes scripts que se sienten reales, no producidos.

CONTEXTO DE LA CAMPAÑA:
- Nombre: ${d.campaign_name}
- Problema detectado: ${d.problem}
- Causa probable: ${d.probable_cause}
- Objetivo creativo: ${d.creative_goal}
${input.campaign_objective ? `- Objetivo de campaña: ${input.campaign_objective}` : ''}

TAREA: Genera 2 scripts UGC. ${anglePart}

REGLAS:
- Cada script tiene 3 partes: hook (3s), body (8-22s), cta (cierre).
- Duración total: 15 ó 30 segundos (uno de cada).
- Tono: primera persona, casual, como hablándole a un amigo.
- Cero jerga publicitaria.
- El hook DEBE detener el scroll en 3s — directo, específico, con un dato o emoción real.
- El body cuenta una mini-historia o muestra un beneficio concreto.
- El cta es un cierre natural (no "Visita nuestra web ya"), más como "Te dejo el link en bio si lo quieres probar".
- Lenguaje claro: si la abuela no entiende, simplificar.

FORMATO DE RESPUESTA — RESPONDE ÚNICAMENTE JSON VÁLIDO, SIN MARKDOWN, SIN COMENTARIOS:
{
  "scripts": [
    {
      "angle": "pain" | "benefit" | "social_proof" | "urgency" | "comparison" | "before_after" | "demonstration",
      "duration_seconds": 15 | 30,
      "hook": "...",
      "body": "...",
      "cta": "..."
    }
  ]
}

Genera exactamente 2 scripts (uno de 15s y uno de 30s). Idioma: español.`
}
