// AdPilot — Creative Lab V1 types.
// Cada output creativo debe responder: ¿qué problema estamos resolviendo?

import type {
  CampaignClassification,
  RecommendationAction,
  RecommendationConfidence,
  SignalSeverity,
  SignalType,
} from '@/shared/types/database'

// ─── Empty state ───
export interface CreativeLabEmpty {
  state: 'empty'
  reason: 'no_meta' | 'no_sync' | 'all_stable'
  message: string
  cta?: { label: string; action: 'connect_meta' | 'sync' }
}

// ─── Angles (la dimensión del enfoque creativo) ───
export type CreativeAngle =
  | 'auto'
  | 'pain'
  | 'benefit'
  | 'social_proof'
  | 'urgency'
  | 'comparison'
  | 'before_after'
  | 'demonstration'

export const ANGLE_LABELS: Record<CreativeAngle, string> = {
  auto:           'Auto (mezcla)',
  pain:           'Dolor',
  benefit:        'Beneficio',
  social_proof:   'Prueba social',
  urgency:        'Urgencia',
  comparison:     'Comparación',
  before_after:   'Antes/Después',
  demonstration: 'Demostración',
}

// ─── Campaign choice (selector list) ───
// Las campañas se priorizan por necesidad creativa.
export interface CampaignChoice {
  id: string
  name: string
  classification: CampaignClassification
  score: number
  // Why we surfaced this campaign:
  priority: number             // lower = más urgente
  problem_label: string        // "Fatiga creativa", "CTR bajo", etc.
  recommendation_action: RecommendationAction | null
  primary_signal_type: SignalType | null
  primary_signal_severity: SignalSeverity | null
  spend: number
  ctr: number
  cpa: number
  roas: number
}

// ─── Diagnosis (mostrado al elegir campaña) ───
export interface CreativeDiagnosis {
  campaign_id: string
  campaign_name: string
  problem: string              // "CTR bajo"
  affected_metric: string      // "CTR 0.45%"
  probable_cause: string       // "El hook no detiene scroll"
  creative_goal: string        // "Crear ángulo más directo y emocional"
  severity: SignalSeverity
  confidence: RecommendationConfidence
  recommendation_action: RecommendationAction | null
}

// ─── Generated outputs ───
export interface HookVariant {
  angle: CreativeAngle
  text: string                 // Máx ~12 palabras
}

export interface CopyVariant {
  angle: CreativeAngle
  body: string                 // 2-3 líneas
}

export interface HeadlineVariant {
  angle: CreativeAngle
  text: string                 // Máx 8 palabras
}

export interface CtaVariant {
  angle: CreativeAngle
  text: string                 // Máx 4 palabras
}

export interface UgcScript {
  angle: CreativeAngle
  duration_seconds: number     // 15 ó 30
  hook: string                 // primer 3s
  body: string                 // beats principales (3-5 frases)
  cta: string                  // cierre
}

export interface GeneratedCreatives {
  campaign_id: string
  campaign_name: string
  diagnosis: CreativeDiagnosis
  angle_used: CreativeAngle    // 'auto' o el ángulo elegido
  hooks: HookVariant[]         // 5
  copies: CopyVariant[]        // 3
  headlines: HeadlineVariant[] // 3
  ctas: CtaVariant[]           // 3
  ugc_scripts: UgcScript[]     // 2
  generated_at: string
}

// ─── Critique ───
export type CritiqueVerdict = 'NO_PUBLICAR' | 'PROBAR' | 'PUBLICAR'

export interface CritiqueResult {
  verdict: CritiqueVerdict
  strengths: string[]
  weaknesses: string[]
  improvements: string[]
  generic_risk: 'low' | 'medium' | 'high'
  connects_to_problem: boolean   // si el creativo aborda el problema diagnosticado
  fixed_version?: {              // solo si verdict === 'NO_PUBLICAR'
    hook: string
    body: string
    cta: string
    why_it_works: string
  }
  raw_text: string               // markdown completo del Critic (para mostrar tal cual)
}

// ─── API responses ───
export interface CreativeLabBootstrap {
  state: 'loaded'
  campaigns: CampaignChoice[]   // ordenado por priority asc (lo más urgente arriba)
}

export type CreativeLabResponse = CreativeLabBootstrap | CreativeLabEmpty
