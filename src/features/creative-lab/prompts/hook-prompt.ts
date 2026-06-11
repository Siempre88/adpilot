// AdPilot — Creative Lab: prompt para hooks.
// Hooks = primer frase del anuncio. 8-12 palabras. Detiene el scroll.

import type { CreativeAngle, CreativeDiagnosis } from '../types'

export interface HookPromptInput {
  diagnosis: CreativeDiagnosis
  angle: CreativeAngle
  campaign_objective?: string
}

export function buildHookPrompt(input: HookPromptInput): string {
  const d = input.diagnosis
  const anglePart = input.angle === 'auto'
    ? 'Mezcla 5 ángulos distintos: dolor, beneficio, prueba social, urgencia, comparación.'
    : `Todos los hooks deben usar el ángulo: ${input.angle}.`

  return `Eres un copywriter de performance senior. Generas hooks para anuncios de Facebook/Instagram que DETIENEN el scroll.

CONTEXTO DE LA CAMPAÑA:
- Nombre: ${d.campaign_name}
- Problema: ${d.problem}
- Métrica afectada: ${d.affected_metric}
- Causa probable: ${d.probable_cause}
- Objetivo creativo: ${d.creative_goal}
${input.campaign_objective ? `- Objetivo de campaña: ${input.campaign_objective}` : ''}

TAREA: Genera 5 hooks. ${anglePart}

REGLAS:
- Máximo 12 palabras por hook.
- Cada hook debe ser una frase completa que se pueda decir en voz alta en 3 segundos.
- Nada de clickbait barato ("no vas a creer…").
- Nada de superlativos vacíos ("el mejor", "increíble", "revolucionario").
- Habla como persona, no como anuncio.
- Datos concretos > adjetivos.
- Si el problema es CTR bajo: el hook debe ser MÁS específico y emocional que el actual.
- Si el problema es fatiga creativa: el hook debe abrir un ángulo NUEVO.
- Si el problema es high CPA: el hook debe filtrar audiencia (calificar al lector).
- Si el problema es landing: el hook debe alinear expectativa con lo que verán al hacer click.

FORMATO DE RESPUESTA — RESPONDE ÚNICAMENTE JSON VÁLIDO, SIN MARKDOWN, SIN COMENTARIOS:
{
  "hooks": [
    { "angle": "pain" | "benefit" | "social_proof" | "urgency" | "comparison" | "before_after" | "demonstration", "text": "..." }
  ]
}

Genera exactamente 5 hooks. Idioma: español.`
}
