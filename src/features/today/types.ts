// AdPilot — Today feature types.
// La pantalla Today consume estos tipos. La API /api/today los devuelve.

import type {
  CampaignClassification,
  RecommendationAction,
  RecommendationConfidence,
  RecommendationUrgency,
  SignalType,
  SignalSeverity,
} from '@/shared/types/database'

// ─── Empty states ───
// Si falta algo en el setup, la API devuelve un state explícito en vez de TodayData.
export type TodayEmptyReason = 'no_meta' | 'no_sync' | 'all_stable'

export interface TodayEmpty {
  state: 'empty'
  reason: TodayEmptyReason
  message: string
  cta?: { label: string; action: 'connect_meta' | 'sync' | 'view_campaigns' }
  // En 'all_stable' incluimos algunas ganadoras para mostrar
  winners?: WinnerCard[]
}

// ─── Action card (recomendación accionable) ───
export interface TodayAction {
  campaign_id: string
  campaign_name: string
  action: RecommendationAction
  reason: string
  impact_value: number
  impact_type: 'opportunity' | 'loss_prevention'
  impact_description: string
  urgency: RecommendationUrgency
  confidence: RecommendationConfidence
}

// ─── Winners ───
export interface WinnerCard {
  campaign_id: string
  campaign_name: string
  score: number
  classification: CampaignClassification
  spend: number
  revenue: number
  roas: number
  cpa: number
  ctr: number
  reason: string  // por qué está ganando, frase corta
}

// ─── Risks ───
export interface RiskSignal {
  type: SignalType
  severity: SignalSeverity
  explanation: string
}

export interface RiskCard {
  campaign_id: string
  campaign_name: string
  classification: CampaignClassification
  score: number
  spend: number
  primary_signal: RiskSignal | null
  signals_count: number
  recommendation_action: RecommendationAction | null
  recommendation_short: string  // verbo + 1 dato concreto
}

// ─── Header summary ───
export type AccountStatus = 'healthy' | 'at_risk' | 'critical' | 'idle'

export interface TodayHeader {
  date: string                 // ISO date (YYYY-MM-DD)
  total_actions: number        // total recomendaciones accionables
  visible_actions: number      // las que mostramos (max 3)
  avoidable_loss: number       // $/día
  revenue_opportunity: number  // $/día potencial
  account_status: AccountStatus
  account_status_label: string // legible: "En riesgo", "Saludable", etc.
}

// ─── AI summary (rule-based template, voz brutal) ───
export interface TodayAiSummary {
  text: string                 // 2-3 frases, cada insight termina en acción
}

// ─── Full payload ───
export interface TodayData {
  state: 'loaded'
  header: TodayHeader
  actions: TodayAction[]       // máximo 3
  winners: WinnerCard[]        // máximo 3
  risks: RiskCard[]            // máximo 3
  ai_summary: TodayAiSummary
}

export type TodayResponse = TodayData | TodayEmpty
