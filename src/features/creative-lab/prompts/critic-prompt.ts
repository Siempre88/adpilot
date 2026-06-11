// AdPilot — Creative Lab: prompt para Critic Mode.
// Reusa la persona base de lib/ai/prompts.ts y la enfoca en evaluación.

import { CRITIC_SYSTEM_PROMPT } from '@/lib/ai/prompts'
import type { CreativeDiagnosis } from '../types'

export interface CriticPromptInput {
  diagnosis: CreativeDiagnosis | null  // contexto opcional: cuál era el problema
  creative_text: string                // hook / copy / script completo
  type_hint?: 'hook' | 'copy' | 'headline' | 'cta' | 'ugc_script' | 'ad'
}

export function buildCriticSystemPrompt(input: CriticPromptInput): string {
  const ctx = input.diagnosis
    ? `\n\nCONTEXTO DE LA CAMPAÑA:\n- ${input.diagnosis.campaign_name}\n- Problema: ${input.diagnosis.problem}\n- Métrica afectada: ${input.diagnosis.affected_metric}\n- Causa probable: ${input.diagnosis.probable_cause}\n- Objetivo creativo: ${input.diagnosis.creative_goal}\n\nADEMÁS DE TU EVALUACIÓN GENERAL, RESPONDE: ¿este creativo aborda el problema detectado?`
    : ''

  const extra = `

REGLAS ADICIONALES:
- Sé honesto y directo. Si el creativo es genérico, dilo.
- Marca riesgo de ser genérico: BAJO / MEDIO / ALTO.
- Si el contexto incluye un problema detectado, responde explícitamente si el creativo lo aborda (sí/no/parcialmente).
- Idioma: español.`

  return CRITIC_SYSTEM_PROMPT + ctx + extra
}

export function buildCriticUserMessage(input: CriticPromptInput): string {
  const typeLabel = input.type_hint
    ? { hook: 'Hook', copy: 'Copy', headline: 'Headline', cta: 'CTA', ugc_script: 'Script UGC', ad: 'Anuncio' }[input.type_hint]
    : 'Creativo'
  return `Evalúa este ${typeLabel}:

"""
${input.creative_text}
"""`
}
