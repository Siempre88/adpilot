// ─── Billing Plans ───

export type PlanTier = 'free' | 'pro'

export interface PlanLimits {
  max_campaigns_visible: number   // free: 1, pro: unlimited
  action_plan_steps: number       // free: 1 (teaser), pro: 5
  full_impact: boolean            // free: false, pro: true
  full_priorities: boolean        // free: false, pro: true
  chat_messages_per_day: number   // free: 3, pro: unlimited (999)
  decision_center: boolean        // free: false, pro: true
}

export const PLAN_CONFIG: Record<PlanTier, PlanLimits> = {
  free: {
    max_campaigns_visible: 1,
    action_plan_steps: 1,
    full_impact: false,
    full_priorities: false,
    chat_messages_per_day: 3,
    decision_center: false,
  },
  pro: {
    max_campaigns_visible: 999,
    action_plan_steps: 5,
    full_impact: true,
    full_priorities: true,
    chat_messages_per_day: 999,
    decision_center: true,
  },
}

// ─── Campaign Objectives (Facebook API) ───
export type CampaignObjective =
  | 'OUTCOME_SALES'
  | 'OUTCOME_LEADS'
  | 'OUTCOME_TRAFFIC'
  | 'OUTCOME_ENGAGEMENT'
  | 'OUTCOME_AWARENESS'

// ─── Status ───
export type CampaignStatus = 'ACTIVE' | 'PAUSED' | 'DELETED' | 'ARCHIVED'

export type DeliveryStatus =
  | 'ACTIVE'
  | 'PAUSED'
  | 'LEARNING'
  | 'LEARNING_LIMITED'
  | 'CAMPAIGN_PAUSED'
  | 'ADSET_PAUSED'
  | 'WITH_ISSUES'

// ─── Classification (AdPilot) ───
// Extended in Día 3. 'new' kept as alias of 'learning' for backwards compat
// in legacy code paths; new code should use 'learning'.
export type CampaignClassification =
  | 'winner'
  | 'healthy'
  | 'at_risk'
  | 'loser'
  | 'learning'
  | 'no_data'
  | 'new'

// ─── Time Windows ───
export type TimeWindow = 'last_1d' | 'last_3d' | 'last_7d' | 'last_14d'

// ─── Metric Set (output of metrics engine) ───
// Normalizado, sin divisiones por cero, sin nulls.
// Es la fuente de verdad para todo lo que sigue (score, signals, recs).
export interface MetricSet {
  // Volumen
  spend: number
  impressions: number
  clicks: number
  reach: number

  // Eficiencia
  ctr: number          // %
  cpc: number          // $
  cpm: number          // $
  frequency: number

  // Resultado
  conversions: number
  revenue: number
  cpa: number          // 0 si no hay conversiones
  roas: number         // 0 si no hay revenue

  // Contexto
  hasRevenue: boolean  // pixel/CAPI tracking detected
  daysCovered: number
  isNew: boolean       // bajo umbral de spend
}

// ─── Signal (señal detectada por reglas) ───
export type SignalType =
  | 'creative_fatigue'
  | 'zombie_campaign'
  | 'high_cpa'
  | 'low_ctr'
  | 'ready_to_scale'
  | 'landing_problem'
  | 'audience_saturation'
  | 'overspend'
  | 'underspend'
  | 'learning_limited'

export type SignalSeverity = 'critical' | 'high' | 'medium' | 'low'

export interface Signal {
  type: SignalType
  severity: SignalSeverity
  confidence: RecommendationConfidence
  explanation: string                  // Frase corta accionable, no descriptiva
  impact_value: number                 // $ por día (estimado)
  impact_type: 'opportunity' | 'loss_prevention'
  triggered_metrics: Record<string, number | string>
}

// ─── Score Result (output of score engine) ───
export interface ScoreResult {
  score: number                        // 0–100
  confidence: RecommendationConfidence
}

// ─── Alert Types ───
export type AlertSeverity = 'critical' | 'high' | 'medium' | 'low'

export type DecisionType =
  | 'PAUSE'
  | 'REDUCE_BUDGET'
  | 'SCALE'
  | 'DUPLICATE'
  | 'CHANGE_CREATIVE'
  | 'CHANGE_TARGETING'

// ─── Core Entities ───

export interface AdAccount {
  id: string
  name: string
  currency: string
  timezone: string
}

export interface Campaign {
  id: string
  ad_account_id: string
  name: string
  status: CampaignStatus
  objective: CampaignObjective
  daily_budget: number // in dollars
  lifetime_budget: number | null
  delivery_status: DeliveryStatus
  created_at: string
  updated_at: string
}

export interface AdSet {
  id: string
  campaign_id: string
  name: string
  status: CampaignStatus
  daily_budget: number
  delivery_status: DeliveryStatus
  created_at: string
}

export interface Ad {
  id: string
  ad_set_id: string
  campaign_id: string
  name: string
  status: CampaignStatus
  creative_type: 'IMAGE' | 'VIDEO' | 'CAROUSEL'
  created_at: string
}

export interface AdInsightsDaily {
  id: string
  campaign_id: string
  ad_set_id: string | null
  ad_id: string | null
  date: string
  impressions: number
  clicks: number
  spend: number
  reach: number
  frequency: number
  cpc: number
  cpm: number
  ctr: number
  conversions: number
  conversion_value: number
  cost_per_conversion: number
}

export interface Alert {
  id: string
  campaign_id: string
  campaign_name: string
  type: DecisionType
  severity: AlertSeverity
  problem: string
  impact: string
  action: string
  is_read: boolean
  created_at: string
}

// ─── Recommendation & Score ───

export type RecommendationAction =
  | 'SCALE'
  | 'MONITOR'
  | 'PAUSE'
  | 'REVIEW_CREATIVE'
  | 'REVIEW_TARGETING'
  | 'WAIT'
  // Día 3 additions:
  | 'FIX_LANDING'
  | 'REDUCE_BUDGET'

export type RecommendationConfidence = 'low' | 'medium' | 'high'

export interface RecommendationExplanation {
  headline: string         // Short: "CTR demasiado bajo"
  reason: string           // "La campaña tiene CTR de 0.55% y ya gastó..."
  trigger_metrics: string[] // ["ctr: 0.55%", "spend: $23.12"]
}

export interface CampaignRecommendation {
  action: RecommendationAction
  label: string
  reason: string
  priority: 'urgent' | 'opportunity' | 'risk' | 'info'
  confidence: RecommendationConfidence
  explanation: RecommendationExplanation
}

// ─── Día 3 Recommendation (signals → actionable output) ───
export type RecommendationUrgency = 'now' | 'today' | 'this_week' | 'no_rush'

export interface Recommendation {
  action: RecommendationAction
  reason: string                        // Frase corta accionable
  expectedImpact: {
    type: 'opportunity' | 'loss_prevention'
    value: number                       // $/día
    description: string
  }
  urgency: RecommendationUrgency
  confidence: RecommendationConfidence
  source_signals: SignalType[]          // qué señales la dispararon
}

// ─── Creative Lab ───

export interface CreativePattern {
  pattern: string          // "Imagen de producto con fondo limpio"
  avg_ctr: number
  sample_campaigns: string[]
  frequency: number        // How many winning campaigns use this
}

export interface CreativeInsights {
  winning_patterns: CreativePattern[]
  losing_patterns: CreativePattern[]
  best_ctr: number
  worst_ctr: number
  recommendation: string
}

export interface GeneratedCreative {
  campaign_name: string
  campaign_score: number
  current_ctr: number
  target_ctr: number
  headline: string
  body: string
  cta: string
  hook: string
  image_prompt: string
  image_url: string | null  // null until generated
  rationale: string         // Why this creative, backed by data
  based_on: string[]        // Names of winning campaigns that inspired it
}

// ─── Impact Analysis & Simulation ───

export type ImpactType = 'opportunity' | 'loss_prevention'

export interface ImpactAnalysis {
  type: ImpactType
  value: number                  // Estimated $ impact
  confidence: RecommendationConfidence
  description: string            // "Ahorras $3.30/día" or "Ganas +$1.75/día"
}

export interface SimulationResult {
  projected_spend: number
  projected_ctr: number
  projected_clicks: number
  projected_conversions: number
  impact_value: number           // $ difference vs current
  impact_description: string
}

export interface PriorityAction {
  campaign_id: string
  campaign_name: string
  action: RecommendationAction
  impact: ImpactAnalysis
  confidence: RecommendationConfidence
  reason: string
  score: number
}

// ─── Daily Action Plan ───

export type EffortLevel = 'low' | 'medium' | 'high'

export interface ActionPlanStep {
  step: number
  campaign_id: string
  campaign_name: string
  action: RecommendationAction
  label: string                // "Revisar creativo", "Escalar"
  short_instruction: string    // "Prueba nuevo copy o imagen"
  impact_type: ImpactType
  impact_value: number         // $/day
  impact_monthly: number       // $/month projection
  confidence: RecommendationConfidence
  effort: EffortLevel
  reason: string
  score: number
}

export interface DailyActionPlan {
  date: string
  steps: ActionPlanStep[]
  total_savings: number        // sum of loss_prevention impacts
  total_opportunity: number    // sum of opportunity impacts
  total_impact: number         // savings + opportunity
  execution_time: string       // "~15 min" estimated
}

// ─── Aggregated Views (for dashboard/API responses) ───

export interface CampaignWithMetrics extends Campaign {
  // Aggregated from insights (last 7 days by default)
  total_spend: number
  total_impressions: number
  total_clicks: number
  total_conversions: number
  total_conversion_value: number
  avg_ctr: number
  avg_cpc: number
  avg_cpm: number
  roas: number
  cpa: number
  avg_frequency: number
  classification: CampaignClassification
  // Trend (vs previous period)
  ctr_trend: number
  cpa_trend: number
  roas_trend: number
  // Decision layer
  score: number  // 0-100
  recommendation: CampaignRecommendation
  impact: ImpactAnalysis
}

export interface DashboardSummary {
  total_spend: number
  total_revenue: number
  overall_roas: number
  avg_ctr: number
  avg_cpc: number
  active_campaigns: number
  winning_campaigns: number
  losing_campaigns: number
  at_risk_campaigns: number
  daily_loss: number // spend on losing campaigns per day
  top_campaigns: CampaignWithMetrics[]
  worst_campaigns: CampaignWithMetrics[]
}

export interface ExecutiveSummary {
  date: string
  total_spend: number
  total_revenue: number
  overall_roas: number
  working: { campaign_name: string; detail: string }[]
  failing: { campaign_name: string; detail: string }[]
  actions: { type: DecisionType; campaign_name: string; detail: string }[]
  priorities: DailyPriority[]
  top_actions: PriorityAction[]
  action_plan: DailyActionPlan
  avoidable_loss: number
  revenue_opportunity: number
  total_impact: number
}

export interface DailyPriority {
  type: 'urgent' | 'opportunity' | 'risk' | 'watch'
  campaign_name: string
  message: string
  action: RecommendationAction
  impact_value: number
  impact_description: string
}
