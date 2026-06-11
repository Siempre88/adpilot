// AdPilot — Creative Lab: prompt para copies, headlines y CTAs (3+3+3).
// Generamos los tres en una sola llamada para mantener coherencia.

import type { CreativeAngle, CreativeDiagnosis } from '../types'

export interface CopyPromptInput {
  diagnosis: CreativeDiagnosis
  angle: CreativeAngle
  campaign_objective?: string
}

export function buildCopyPrompt(input: CopyPromptInput): string {
  const d = input.diagnosis
  const anglePart = input.angle === 'auto'
    ? 'Mezcla ángulos distintos en cada variante: dolor, beneficio, prueba social, urgencia, comparación.'
    : `Todas las variantes deben usar el ángulo: ${input.angle}.`

  return `Eres un copywriter de performance senior. Escribes copies, headlines y CTAs para anuncios de Facebook/Instagram.

CONTEXTO DE LA CAMPAÑA:
- Nombre: ${d.campaign_name}
- Problema: ${d.problem}
- Causa probable: ${d.probable_cause}
- Objetivo creativo: ${d.creative_goal}
${input.campaign_objective ? `- Objetivo de campaña: ${input.campaign_objective}` : ''}

TAREA: Genera 3 copies, 3 headlines y 3 CTAs. ${anglePart}

REGLAS DE COPY (body principal):
- Máximo 2-3 líneas (≤ 280 caracteres).
- Frases cortas, directas.
- Beneficio concreto > adjetivo vacío.
- Datos reales si tiene sentido (cantidad, tiempo, formato).
- Cero jerga corporativa ("propuesta de valor", "engagement", "funnel").
- Cero clickbait ("no vas a creer…").

REGLAS DE HEADLINE:
- Máximo 8 palabras.
- Es la promesa principal en 1 línea.
- Debe poder leerse en 1 segundo y entenderse.

REGLAS DE CTA:
- Máximo 4 palabras.
- Verbo + qué pasa al hacer click.
- Específico ("Pide los míos") > genérico ("Más información").

FORMATO DE RESPUESTA — RESPONDE ÚNICAMENTE JSON VÁLIDO, SIN MARKDOWN, SIN COMENTARIOS:
{
  "copies":    [{ "angle": "pain" | "benefit" | "social_proof" | "urgency" | "comparison" | "before_after" | "demonstration", "body": "..." }],
  "headlines": [{ "angle": "...", "text": "..." }],
  "ctas":      [{ "angle": "...", "text": "..." }]
}

Genera exactamente 3 copies, 3 headlines y 3 CTAs. Idioma: español.`
}
