// AdPilot — Recommendations Center types.
// La pantalla /recommendations consume estos tipos.

import type {
  CampaignClassification,
  RecommendationAction,
  RecommendationConfidence,
  RecommendationUrgency,
  SignalSeverity,
  SignalType,
} from '@/shared/types/database'

// ─── Empty states ───
export type RecommendationsEmptyReason = 'no_data' | 'all_stable'

export interface RecommendationsEmpty {
  state: 'empty'
  reason: RecommendationsEmptyReason
  message: string
  cta?: { label: string; action: 'sync' | 'view_today' | 'connect_meta' }
}

// ─── Action filter (UI tabs/pills) ───
// 'all' = sin filtro. El resto coincide con RecommendationAction.
export type RecommendationFilter = 'all' | RecommendationAction

export interface FilterOption {
  key: RecommendationFilter
  label: string
  count: number
}

// ─── Compact metrics shown on the card ───
export interface CardMetrics {
  spend: number
  roas: number
  cpa: number
  ctr: number
  frequency: number
  conversions: number
  hasRevenue: boolean
}

// ─── Time-window comparison (1d / 3d / 7d / 14d) ───
export interface WindowSnapshot {
  window: '1d' | '3d' | '7d' | '14d'
  spend: number
  ctr: number
  cpc: number
  cpa: number
  roas: number
  conversions: number
  daysCovered: number
}

// ─── Signal as shown on the detail panel ───
export interface SignalDisplay {
  type: SignalType
  type_label: string
  severity: SignalSeverity
  explanation: string
  impact_value: number
  impact_type: 'opportunity' | 'loss_prevention'
}

// ─── Card (collapsed view) ───
export interface RecommendationCardData {
  id: string                          // recommendation row id
  campaign_id: string
  campaign_name: string
  classification: CampaignClassification
  score: number
  action: RecommendationAction
  action_label: string
  reason: string                      // 1-line, accionable
  urgency: RecommendationUrgency
  severity: SignalSeverity             // worst signal severity (or derived from action)
  confidence: RecommendationConfidence
  impact_value: number
  impact_type: 'opportunity' | 'loss_prevention'
  impact_description: string
  metrics: CardMetrics
  signals_count: number
  reviewed_at: string | null
}

// ─── Detail (expanded view) ───
export interface RecommendationDetail extends RecommendationCardData {
  signals: SignalDisplay[]            // todas las señales que contribuyeron
  reasoning: string                   // párrafo humano explicando el porqué
  next_step: string                   // siguiente paso concreto
  windows: WindowSnapshot[]           // 1d / 3d / 7d / 14d para comparar
}

// ─── Summary (4 stats arriba) ───
export interface RecommendationsSummary {
  total: number
  critical: number
  scale_opportunities: number
  avoidable_loss: number              // $/día
  revenue_opportunity: number         // $/día
}

// ─── Full payload ───
export interface RecommendationsData {
  state: 'loaded'
  summary: RecommendationsSummary
  filters: FilterOption[]             // contadores por tipo de acción
  recommendations: RecommendationDetail[]
}

export type RecommendationsResponse = RecommendationsData | RecommendationsEmpty
