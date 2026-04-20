// ─────────────────────────────────────────────────────────────
// AdPilot — Meta Ads Service (Graph API v21.0)
// Solo lectura. Sin automatizaciones. MVP Fase 1.
//
// SEGURIDAD: El token NUNCA debe exponerse al frontend.
// Este archivo solo se ejecuta en el servidor (API routes).
// ─────────────────────────────────────────────────────────────

import type {
  CampaignWithMetrics,
  CampaignClassification,
  CampaignRecommendation,
  RecommendationConfidence,
  RecommendationExplanation,
  ImpactAnalysis,
  SimulationResult,
  PriorityAction,
  DailyActionPlan,
  ActionPlanStep,
  EffortLevel,
  DashboardSummary,
  ExecutiveSummary,
  DailyPriority,
  Alert,
  AlertSeverity,
  DecisionType,
  RecommendationAction,
} from '@/shared/types/database'

const GRAPH_API_VERSION = 'v21.0'
const GRAPH_API_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`

// Per-request credentials (set by API routes from user's DB connection)
let _requestToken = ''
let _requestAccountId = ''

export function setRequestCredentials(token: string, accountId: string) {
  _requestToken = token
  _requestAccountId = accountId
}

function getConfig() {
  // Priority: per-request > env vars (env vars as fallback for dev/testing)
  const token = _requestToken || process.env.META_ACCESS_TOKEN
  const accountId = _requestAccountId || process.env.META_AD_ACCOUNT_ID
  if (!token || !accountId) {
    throw new Error('No Meta credentials available. Connect your account in Settings.')
  }
  return { token, accountId }
}

// ─── Graph API Fetch Helper ───

async function graphFetch<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const { token } = getConfig()
  const url = new URL(`${GRAPH_API_BASE}${path}`)
  url.searchParams.set('access_token', token)
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value)
  }

  const res = await fetch(url.toString(), { next: { revalidate: 60 } })
  const json = await res.json()

  if (json.error) {
    const code = json.error.code
    const subcode = json.error.error_subcode
    console.error('[Meta Ads API Error]', json.error)

    // Auth errors: expired, invalid, logged out
    if (code === 190 || code === 102) {
      const status = subcode === 463 ? 'expired'
        : subcode === 467 ? 'expired'   // session invalid / logged out
        : subcode === 460 ? 'expired'   // password changed
        : 'invalid'
      throw new MetaAuthError(json.error.message, status)
    }

    throw new Error(`Meta API: ${json.error.message}`)
  }

  return json
}

// Custom error for auth issues
export class MetaAuthError extends Error {
  status: 'expired' | 'invalid'
  constructor(message: string, status: 'expired' | 'invalid') {
    super(message)
    this.name = 'MetaAuthError'
    this.status = status
  }
}

// Validate token without heavy API call
export async function validateMetaToken(): Promise<{ status: 'connected' | 'expired' | 'invalid' | 'missing'; message: string }> {
  const token = process.env.META_ACCESS_TOKEN
  const accountId = process.env.META_AD_ACCOUNT_ID
  if (!token || !accountId) return { status: 'missing', message: 'META_ACCESS_TOKEN o META_AD_ACCOUNT_ID no configurados' }

  try {
    const res = await fetch(`${GRAPH_API_BASE}/debug_token?input_token=${token}&access_token=${token}`)
    const json = await res.json()

    if (json.error) {
      const code = json.error.code
      if (code === 190) return { status: 'expired', message: 'Token expirado o sesión inválida' }
      return { status: 'invalid', message: json.error.message }
    }

    const data = json.data
    if (!data?.is_valid) return { status: 'expired', message: 'Token inválido o expirado' }

    return { status: 'connected', message: `Token válido. Expira: ${data.expires_at ? new Date(data.expires_at * 1000).toLocaleDateString() : 'nunca'}` }
  } catch (err) {
    return { status: 'invalid', message: 'No se pudo validar el token' }
  }
}

// ─── Types for raw Graph API responses ───

interface MetaCampaign {
  id: string
  name: string
  status: string
  objective: string
  daily_budget?: string
  lifetime_budget?: string
  effective_status: string
  created_time: string
  updated_time: string
}

interface MetaInsight {
  campaign_id: string
  campaign_name: string
  impressions: string
  clicks: string
  spend: string
  reach: string
  frequency: string
  cpc?: string
  cpm?: string
  ctr: string
  actions?: { action_type: string; value: string }[]
  action_values?: { action_type: string; value: string }[]
  cost_per_action_type?: { action_type: string; value: string }[]
  date_start: string
  date_stop: string
}

// ─── Date presets ───

type DatePreset = 'today' | 'yesterday' | 'last_3d' | 'last_7d' | 'last_14d' | 'last_30d' | 'last_90d' | 'maximum'

function daysFromPreset(preset: DatePreset): number {
  const map: Record<DatePreset, number> = {
    today: 1, yesterday: 1, last_3d: 3, last_7d: 7, last_14d: 14, last_30d: 30, last_90d: 90, maximum: 365,
  }
  return map[preset] || 7
}

// ─── Parse helpers ───

function parseNum(val: string | undefined, fallback = 0): number {
  if (!val) return fallback
  const n = parseFloat(val)
  return isNaN(n) ? fallback : Math.round(n * 100) / 100
}

function extractAction(actions: { action_type: string; value: string }[] | undefined, type: string): number {
  if (!actions) return 0
  // Try exact match first, then common variants
  const types = [type, `offsite_conversion.fb_pixel_${type}`, `omni_${type}`]
  for (const t of types) {
    const found = actions.find((a) => a.action_type === t)
    if (found) return parseNum(found.value)
  }
  return 0
}

function extractConversions(actions: { action_type: string; value: string }[] | undefined): number {
  if (!actions) return 0
  // Sum common conversion actions
  const convTypes = [
    'purchase', 'lead', 'complete_registration', 'initiate_checkout',
    'offsite_conversion.fb_pixel_purchase', 'offsite_conversion.fb_pixel_lead',
    'omni_purchase', 'onsite_conversion.messaging_conversation_started_7d',
  ]
  let total = 0
  for (const a of actions) {
    if (convTypes.includes(a.action_type)) {
      total += parseNum(a.value)
    }
  }
  // If no specific conversions, try "results" or any generic conversion
  if (total === 0) {
    const results = actions.find(a => a.action_type === 'link_click')
    // Don't count link_clicks as conversions - return 0
  }
  return total
}

function extractRevenue(actionValues: { action_type: string; value: string }[] | undefined): number {
  if (!actionValues) return 0
  const revTypes = ['purchase', 'offsite_conversion.fb_pixel_purchase', 'omni_purchase']
  for (const a of actionValues) {
    if (revTypes.includes(a.action_type)) return parseNum(a.value)
  }
  return 0
}

// ─── Map Meta status to our types ───

function mapDeliveryStatus(effectiveStatus: string) {
  const map: Record<string, string> = {
    ACTIVE: 'ACTIVE',
    PAUSED: 'PAUSED',
    CAMPAIGN_PAUSED: 'CAMPAIGN_PAUSED',
    ADSET_PAUSED: 'ADSET_PAUSED',
    IN_PROCESS: 'LEARNING',
    WITH_ISSUES: 'WITH_ISSUES',
    LEARNING_LIMITED: 'LEARNING_LIMITED',
  }
  return (map[effectiveStatus] || effectiveStatus) as any
}

function mapObjective(objective: string) {
  const map: Record<string, string> = {
    OUTCOME_SALES: 'OUTCOME_SALES',
    OUTCOME_LEADS: 'OUTCOME_LEADS',
    OUTCOME_TRAFFIC: 'OUTCOME_TRAFFIC',
    OUTCOME_ENGAGEMENT: 'OUTCOME_ENGAGEMENT',
    OUTCOME_AWARENESS: 'OUTCOME_AWARENESS',
    // Legacy objectives
    CONVERSIONS: 'OUTCOME_SALES',
    LEAD_GENERATION: 'OUTCOME_LEADS',
    LINK_CLICKS: 'OUTCOME_TRAFFIC',
    POST_ENGAGEMENT: 'OUTCOME_ENGAGEMENT',
    REACH: 'OUTCOME_AWARENESS',
    BRAND_AWARENESS: 'OUTCOME_AWARENESS',
    MESSAGES: 'OUTCOME_ENGAGEMENT',
    VIDEO_VIEWS: 'OUTCOME_AWARENESS',
  }
  return (map[objective] || 'OUTCOME_SALES') as any
}

// ─── Classification (from BUSINESS_LOGIC.md) ───

function classifyCampaign(metrics: {
  roas: number
  cpa: number
  spend: number
  conversions: number
  ctr: number
  cpc: number
  frequency: number
  days: number
  objective: string
  hasRevenue: boolean
}): CampaignClassification {
  // New campaign (less than $5 spent)
  if (metrics.spend < 5) return 'new'

  // If campaign has trackable revenue (pixel/CAPI), use ROAS-based classification
  if (metrics.hasRevenue) {
    if (metrics.roas >= 2.5) return 'winner'
    if (metrics.roas >= 1.5) return 'at_risk'
    if (metrics.conversions === 0 && metrics.spend > 30) return 'loser'
    return 'loser'
  }

  // For campaigns WITHOUT revenue tracking (Marketplace, engagement, traffic, awareness):
  // Classify by engagement efficiency (CTR + CPC)
  if (metrics.ctr >= 3.0 && metrics.cpc < 0.10) return 'winner'
  if (metrics.ctr >= 1.5) return 'winner'
  if (metrics.ctr >= 0.8) return 'at_risk'
  if (metrics.ctr < 0.8 && metrics.spend > 10) return 'loser'

  return 'at_risk'
}

// ─── Campaign Score (0-100) ───
// Score = weighted sum of normalized metrics
// CTR weight: 30, CPC efficiency: 20, Spend efficiency: 15,
// Conversions: 20, Frequency health: 15

function calculateScore(metrics: {
  ctr: number
  cpc: number
  spend: number
  conversions: number
  frequency: number
  roas: number
  hasRevenue: boolean
  classification: CampaignClassification
}): number {
  // CTR score (0-30): 0% = 0pts, 1% = 15pts, 3%+ = 30pts
  const ctrScore = Math.min(30, (metrics.ctr / 3) * 30)

  // CPC efficiency (0-20): $0 = 20pts, $0.05 = 15pts, $1+ = 5pts, $3+ = 0pts
  const cpcScore = metrics.cpc <= 0.01 ? 20
    : metrics.cpc <= 0.05 ? 18
    : metrics.cpc <= 0.50 ? 15
    : metrics.cpc <= 1.50 ? 10
    : metrics.cpc <= 3 ? 5 : 0

  // Spend efficiency (0-15): has results relative to spend
  let spendScore = 0
  if (metrics.hasRevenue && metrics.roas > 0) {
    spendScore = Math.min(15, (metrics.roas / 3) * 15)
  } else if (metrics.conversions > 0) {
    // For non-revenue campaigns: conversions per $ spent
    const convPerDollar = metrics.spend > 0 ? metrics.conversions / metrics.spend : 0
    spendScore = Math.min(15, convPerDollar * 15)
  } else if (metrics.ctr > 2) {
    spendScore = 10 // Good engagement even without conversions
  }

  // Conversion score (0-20)
  const convScore = metrics.conversions > 0
    ? Math.min(20, (metrics.conversions / 10) * 20)
    : metrics.ctr > 3 ? 10 : 0  // Give credit for high engagement

  // Frequency health (0-15): 1.0 = 15pts, 2.0 = 10pts, 3+ = 0pts
  const freqScore = metrics.frequency <= 1.5 ? 15
    : metrics.frequency <= 2.0 ? 12
    : metrics.frequency <= 2.5 ? 8
    : metrics.frequency <= 3.0 ? 4 : 0

  const total = Math.round(ctrScore + cpcScore + spendScore + convScore + freqScore)

  // Clamp 0-100 and penalize losers
  if (metrics.classification === 'loser') return Math.min(total, 25)
  if (metrics.classification === 'new') return Math.min(total, 50)
  return Math.min(100, total)
}

// ─── Confidence Calculation ───
// Based on data volume: more data = higher confidence

function calculateConfidence(m: {
  spend: number
  impressions: number
  clicks: number
  conversions: number
}): RecommendationConfidence {
  // Score data sufficiency 0-10
  let points = 0
  if (m.spend >= 5) points += 1
  if (m.spend >= 15) points += 1
  if (m.spend >= 30) points += 1
  if (m.impressions >= 1000) points += 1
  if (m.impressions >= 5000) points += 1
  if (m.impressions >= 10000) points += 1
  if (m.clicks >= 50) points += 1
  if (m.clicks >= 200) points += 1
  if (m.clicks >= 500) points += 1
  if (m.conversions >= 1) points += 1

  if (points >= 7) return 'high'
  if (points >= 4) return 'medium'
  return 'low'
}

// ─── Explanation Builder ───

function buildExplanation(
  action: RecommendationAction,
  m: { ctr: number; cpc: number; spend: number; conversions: number; frequency: number; roas: number; score: number; impressions: number }
): RecommendationExplanation {
  const fmt = (n: number) => n.toFixed(2)
  const triggerMetrics: string[] = []

  switch (action) {
    case 'PAUSE':
      triggerMetrics.push(`spend: $${fmt(m.spend)}`, `conversiones: ${m.conversions}`)
      if (m.ctr < 1) triggerMetrics.push(`ctr: ${fmt(m.ctr)}%`)
      return {
        headline: 'Gasto sin retorno',
        reason: `$${fmt(m.spend)} gastados con ${m.conversions} resultados. El presupuesto se está quemando sin generar valor. Pausar para evitar más pérdida.`,
        trigger_metrics: triggerMetrics,
      }
    case 'REVIEW_CREATIVE':
      triggerMetrics.push(`ctr: ${fmt(m.ctr)}%`)
      if (m.frequency > 2) triggerMetrics.push(`frecuencia: ${fmt(m.frequency)}`)
      if (m.cpc > 0.05) triggerMetrics.push(`cpc: $${fmt(m.cpc)}`)
      return {
        headline: m.frequency > 2.5 ? 'Fatiga creativa detectada' : 'CTR demasiado bajo',
        reason: m.frequency > 2.5
          ? `Frecuencia ${fmt(m.frequency)} indica que la audiencia ya vio el anuncio demasiadas veces. CTR ${fmt(m.ctr)}% confirma pérdida de interés.`
          : `CTR de ${fmt(m.ctr)}% está por debajo del mínimo (0.8%). El anuncio no genera suficiente interés para justificar el gasto.`,
        trigger_metrics: triggerMetrics,
      }
    case 'REVIEW_TARGETING':
      triggerMetrics.push(`cpc: $${fmt(m.cpc)}`)
      if (m.ctr < 1.5) triggerMetrics.push(`ctr: ${fmt(m.ctr)}%`)
      triggerMetrics.push(`spend: $${fmt(m.spend)}`)
      return {
        headline: 'Segmentación ineficiente',
        reason: `CPC de $${fmt(m.cpc)} indica que el anuncio no es relevante para la audiencia actual. Probar audiencia más amplia o diferente.`,
        trigger_metrics: triggerMetrics,
      }
    case 'SCALE':
      triggerMetrics.push(`score: ${m.score}/100`, `ctr: ${fmt(m.ctr)}%`)
      if (m.roas > 0) triggerMetrics.push(`roas: ${m.roas.toFixed(1)}x`)
      if (m.cpc > 0) triggerMetrics.push(`cpc: $${fmt(m.cpc)}`)
      return {
        headline: 'Rendimiento excelente',
        reason: `Score ${m.score}/100 con CTR ${fmt(m.ctr)}%. Métricas estables y eficientes. Incrementar presupuesto 20-25% para capturar más alcance.`,
        trigger_metrics: triggerMetrics,
      }
    case 'MONITOR':
      triggerMetrics.push(`score: ${m.score}/100`, `ctr: ${fmt(m.ctr)}%`, `spend: $${fmt(m.spend)}`)
      return {
        headline: 'Rendimiento aceptable',
        reason: `Score ${m.score}/100. Métricas en zona estable. Mantener sin cambios y revisar en 2-3 días.`,
        trigger_metrics: triggerMetrics,
      }
    case 'WAIT':
      triggerMetrics.push(`spend: $${fmt(m.spend)}`)
      if (m.impressions > 0) triggerMetrics.push(`ctr: ${fmt(m.ctr)}%`)
      return {
        headline: 'Datos insuficientes',
        reason: `Solo $${fmt(m.spend)} gastados. Se necesitan al menos $10-15 para evaluar rendimiento con confianza.`,
        trigger_metrics: triggerMetrics,
      }
  }
}

// ─── Campaign Recommendation ───

function generateRecommendation(metrics: {
  classification: CampaignClassification
  score: number
  ctr: number
  cpc: number
  frequency: number
  spend: number
  impressions: number
  clicks: number
  conversions: number
  roas: number
  hasRevenue: boolean
}): CampaignRecommendation {
  const confidence = calculateConfidence({
    spend: metrics.spend, impressions: metrics.impressions,
    clicks: metrics.clicks, conversions: metrics.conversions,
  })
  const explMetrics = {
    ctr: metrics.ctr, cpc: metrics.cpc, spend: metrics.spend,
    conversions: metrics.conversions, frequency: metrics.frequency,
    roas: metrics.roas, score: metrics.score, impressions: metrics.impressions,
  }

  // New / no data
  if (metrics.classification === 'new' || metrics.spend < 5) {
    const action: RecommendationAction = 'WAIT'
    return {
      action, label: 'Esperar', priority: 'info', confidence,
      reason: 'Campaña nueva o sin suficientes datos. Dejar acumular al menos $10-15 de gasto.',
      explanation: buildExplanation(action, explMetrics),
    }
  }

  // Losers
  if (metrics.classification === 'loser') {
    if (metrics.ctr < 0.8) {
      const action: RecommendationAction = 'REVIEW_CREATIVE'
      return {
        action, label: 'Revisar creativo', priority: 'urgent', confidence,
        reason: `CTR ${metrics.ctr.toFixed(2)}% muy bajo. Probar nuevo ángulo visual o copy.`,
        explanation: buildExplanation(action, explMetrics),
      }
    }
    if (metrics.spend > 20 && metrics.conversions === 0) {
      const action: RecommendationAction = 'PAUSE'
      return {
        action, label: 'Pausar', priority: 'urgent', confidence,
        reason: `$${metrics.spend.toFixed(2)} gastados sin resultados. Detener sangrado.`,
        explanation: buildExplanation(action, explMetrics),
      }
    }
    const action: RecommendationAction = 'REVIEW_TARGETING'
    return {
      action, label: 'Revisar segmentación', priority: 'risk', confidence,
      reason: 'Rendimiento bajo. Probar audiencia diferente.',
      explanation: buildExplanation(action, explMetrics),
    }
  }

  // Winners
  if (metrics.classification === 'winner') {
    if (metrics.score >= 70 && metrics.spend >= 5) {
      const action: RecommendationAction = 'SCALE'
      return {
        action, label: 'Escalar', priority: 'opportunity', confidence,
        reason: `Score ${metrics.score}/100. CTR ${metrics.ctr.toFixed(1)}% excelente. Subir presupuesto 20-25%.`,
        explanation: buildExplanation(action, explMetrics),
      }
    }
    if (metrics.frequency > 2.5) {
      const action: RecommendationAction = 'REVIEW_CREATIVE'
      return {
        action, label: 'Rotar creativo', priority: 'risk', confidence,
        reason: `Buen rendimiento pero frecuencia ${metrics.frequency.toFixed(1)}. Rotar antes de fatiga.`,
        explanation: buildExplanation(action, explMetrics),
      }
    }
    const action: RecommendationAction = 'MONITOR'
    return {
      action, label: 'Vigilar', priority: 'info', confidence,
      reason: `Funcionando bien (score ${metrics.score}). Mantener y monitorear.`,
      explanation: buildExplanation(action, explMetrics),
    }
  }

  // At risk
  if (metrics.frequency > 2.5 && metrics.ctr < 1.5) {
    const action: RecommendationAction = 'REVIEW_CREATIVE'
    return {
      action, label: 'Rotar creativo', priority: 'risk', confidence,
      reason: `Fatiga creativa: frecuencia ${metrics.frequency.toFixed(1)} con CTR ${metrics.ctr.toFixed(2)}%.`,
      explanation: buildExplanation(action, explMetrics),
    }
  }
  if (metrics.cpc > 1.5) {
    const action: RecommendationAction = 'REVIEW_TARGETING'
    return {
      action, label: 'Revisar segmentación', priority: 'risk', confidence,
      reason: `CPC alto ($${metrics.cpc.toFixed(2)}). Ampliar audiencia.`,
      explanation: buildExplanation(action, explMetrics),
    }
  }
  const action: RecommendationAction = 'MONITOR'
  return {
    action, label: 'Vigilar', priority: 'info', confidence,
    reason: 'En zona intermedia. Monitorear próximos días.',
    explanation: buildExplanation(action, explMetrics),
  }
}

// ─── Impact Analysis & Simulation ───

function simulateAction(c: CampaignWithMetrics): SimulationResult {
  const action = c.recommendation.action
  const days = 7 // projection period
  const dailySpend = c.total_spend > 0 ? c.total_spend / days : c.daily_budget || 0
  const dailyClicks = c.total_clicks / Math.max(days, 1)
  const dailyConv = c.total_conversions / Math.max(days, 1)

  switch (action) {
    case 'SCALE': {
      // +25% budget → proportional increase in clicks/conv
      const factor = 1.25
      const newSpend = dailySpend * factor * days
      const newClicks = Math.round(dailyClicks * factor * days)
      const newConv = Math.round(dailyConv * factor * days)
      const addedValue = (newClicks - c.total_clicks) * (c.avg_cpc > 0 ? c.avg_cpc : 0.01)
      return {
        projected_spend: r2(newSpend),
        projected_ctr: c.avg_ctr, // CTR stays same
        projected_clicks: newClicks,
        projected_conversions: newConv,
        impact_value: r2(dailySpend * 0.25), // daily additional spend = daily additional reach value
        impact_description: `+$${r2(dailySpend * 0.25)}/día en alcance adicional, ~${Math.round(dailyClicks * 0.25)} clicks más/día`,
      }
    }
    case 'PAUSE': {
      return {
        projected_spend: 0,
        projected_ctr: 0,
        projected_clicks: 0,
        projected_conversions: 0,
        impact_value: r2(dailySpend),
        impact_description: `Ahorras $${r2(dailySpend)}/día ($${r2(dailySpend * 30)}/mes)`,
      }
    }
    case 'REVIEW_CREATIVE': {
      // Estimate: new creative can improve CTR by 30-50%
      const ctrBoost = 1.35
      const newCtr = r2(c.avg_ctr * ctrBoost)
      const newClicks = Math.round(c.total_impressions * (newCtr / 100))
      const clickDiff = newClicks - c.total_clicks
      const newCpc = newClicks > 0 ? r2(c.total_spend / newClicks) : c.avg_cpc
      return {
        projected_spend: c.total_spend, // same spend
        projected_ctr: newCtr,
        projected_clicks: newClicks,
        projected_conversions: c.total_conversions > 0 ? Math.round(c.total_conversions * ctrBoost) : 0,
        impact_value: r2(clickDiff > 0 ? clickDiff * (c.avg_cpc > 0 ? c.avg_cpc : 0.01) : dailySpend * 0.3),
        impact_description: `CTR podría subir de ${c.avg_ctr.toFixed(1)}% a ${newCtr}%, +${Math.max(0, clickDiff)} clicks con mismo gasto`,
      }
    }
    case 'REVIEW_TARGETING': {
      // Better targeting → lower CPC, same spend = more clicks
      const cpcReduction = 0.7
      const newCpc = r2(c.avg_cpc * cpcReduction)
      const newClicks = c.total_spend > 0 && newCpc > 0 ? Math.round(c.total_spend / newCpc) : c.total_clicks
      return {
        projected_spend: c.total_spend,
        projected_ctr: r2(c.avg_ctr * 1.2),
        projected_clicks: newClicks,
        projected_conversions: c.total_conversions,
        impact_value: r2((newClicks - c.total_clicks) * newCpc),
        impact_description: `CPC podría bajar de $${c.avg_cpc.toFixed(2)} a $${newCpc}, +${Math.max(0, newClicks - c.total_clicks)} clicks`,
      }
    }
    default: // MONITOR, WAIT
      return {
        projected_spend: c.total_spend,
        projected_ctr: c.avg_ctr,
        projected_clicks: c.total_clicks,
        projected_conversions: c.total_conversions,
        impact_value: 0,
        impact_description: 'Sin cambio proyectado',
      }
  }
}

function calculateImpact(c: CampaignWithMetrics, sim: SimulationResult): ImpactAnalysis {
  const action = c.recommendation.action
  const confidence = c.recommendation.confidence

  if (action === 'PAUSE') {
    return {
      type: 'loss_prevention',
      value: r2(sim.impact_value),
      confidence,
      description: sim.impact_description,
    }
  }

  if (action === 'SCALE') {
    return {
      type: 'opportunity',
      value: r2(sim.impact_value),
      confidence,
      description: sim.impact_description,
    }
  }

  if (action === 'REVIEW_CREATIVE' || action === 'REVIEW_TARGETING') {
    const isLossPrevention = c.classification === 'loser'
    return {
      type: isLossPrevention ? 'loss_prevention' : 'opportunity',
      value: r2(sim.impact_value),
      confidence,
      description: sim.impact_description,
    }
  }

  return {
    type: 'opportunity',
    value: 0,
    confidence: 'low',
    description: 'Sin impacto estimable',
  }
}

function r2(n: number): number {
  return Math.round(n * 100) / 100
}

// ─── Alert Generation (from BUSINESS_LOGIC.md rules) ───

function generateAlerts(campaigns: CampaignWithMetrics[]): Alert[] {
  const alerts: Alert[] = []
  const now = new Date().toISOString()

  for (const c of campaigns) {
    // Zombie campaign: high spend, 0 conversions
    if (c.total_spend > 50 && c.total_conversions === 0 &&
        !c.objective.includes('TRAFFIC') && !c.objective.includes('AWARENESS')) {
      alerts.push({
        id: `alert_zombie_${c.id}`,
        campaign_id: c.id,
        campaign_name: c.name,
        type: 'PAUSE',
        severity: 'critical',
        problem: `Campaña zombie: $${c.total_spend.toFixed(2)} gastados sin conversiones`,
        impact: `Pérdida directa de $${c.total_spend.toFixed(2)}. Proyección: $${(c.daily_budget || c.total_spend / 7).toFixed(0)}/día`,
        action: 'Pausar inmediatamente. Revisar audiencia, oferta y creativo antes de relanzar',
        is_read: false,
        created_at: now,
      })
    }

    // Creative fatigue: high frequency + low CTR
    if (c.avg_frequency > 2.5 && c.avg_ctr < 1.0) {
      alerts.push({
        id: `alert_fatigue_${c.id}`,
        campaign_id: c.id,
        campaign_name: c.name,
        type: 'CHANGE_CREATIVE',
        severity: 'high',
        problem: `Fatiga creativa: frecuencia ${c.avg_frequency.toFixed(1)}, CTR ${c.avg_ctr.toFixed(2)}%`,
        impact: `CPC inflado. Audiencia saturada con el mismo creativo`,
        action: 'Rotar creativos: nuevo video/imagen con ángulo diferente',
        is_read: false,
        created_at: now,
      })
    }

    // Low CTR
    if (c.avg_ctr < 0.8 && c.total_impressions > 1000) {
      alerts.push({
        id: `alert_lowctr_${c.id}`,
        campaign_id: c.id,
        campaign_name: c.name,
        type: 'CHANGE_CREATIVE',
        severity: 'medium',
        problem: `CTR bajo: ${c.avg_ctr.toFixed(2)}% (mínimo recomendado: 0.8%)`,
        impact: `CPC alto de $${c.avg_cpc.toFixed(2)}. Presupuesto se gasta ineficientemente`,
        action: 'Probar nuevo ángulo de copy o cambiar creativo visual',
        is_read: false,
        created_at: now,
      })
    }

    // High CPC
    if (c.avg_cpc > 3 && c.total_clicks > 10) {
      alerts.push({
        id: `alert_highcpc_${c.id}`,
        campaign_id: c.id,
        campaign_name: c.name,
        type: 'CHANGE_TARGETING',
        severity: 'medium',
        problem: `CPC alto: $${c.avg_cpc.toFixed(2)} (máximo recomendado: $3.00)`,
        impact: `Cada click cuesta más de lo normal. Reduce eficiencia del presupuesto`,
        action: 'Ampliar audiencia o probar creativos más llamativos para mejorar CTR',
        is_read: false,
        created_at: now,
      })
    }

    // Ready to scale
    if (c.classification === 'winner' && c.total_spend > 50 && c.roas >= 3) {
      alerts.push({
        id: `alert_scale_${c.id}`,
        campaign_id: c.id,
        campaign_name: c.name,
        type: 'SCALE',
        severity: 'low',
        problem: `Campaña lista para escalar: ROAS ${c.roas.toFixed(1)}x, CPA $${c.cpa.toFixed(2)}`,
        impact: `Potencial de revenue adicional. Genera $${c.total_conversion_value.toFixed(0)} con $${c.total_spend.toFixed(0)} de inversión`,
        action: 'Subir presupuesto 20-25%. Monitorear CPA las primeras 48h',
        is_read: false,
        created_at: now,
      })
    }
  }

  // Sort: critical first
  const severityOrder: Record<AlertSeverity, number> = { critical: 0, high: 1, medium: 2, low: 3 }
  alerts.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity])

  return alerts
}

// ═══════════════════════════════════════════════════════════
// PUBLIC API — These functions are consumed by API routes
// and Claude AI tools
// ═══════════════════════════════════════════════════════════

export async function getCampaigns(): Promise<MetaCampaign[]> {
  const { accountId } = getConfig()
  const fields = 'id,name,status,objective,daily_budget,lifetime_budget,effective_status,created_time,updated_time'

  const data = await graphFetch<{ data: MetaCampaign[] }>(
    `/${accountId}/campaigns`,
    { fields, limit: '100' }
  )
  return data.data || []
}

const INSIGHT_FIELDS = [
  'campaign_id', 'campaign_name', 'impressions', 'clicks', 'spend',
  'reach', 'frequency', 'cpc', 'cpm', 'ctr',
  'actions', 'action_values', 'cost_per_action_type',
].join(',')

export async function getCampaignInsightsRaw(datePreset: DatePreset = 'last_7d'): Promise<MetaInsight[]> {
  const { accountId } = getConfig()

  const data = await graphFetch<{ data: MetaInsight[] }>(
    `/${accountId}/insights`,
    {
      fields: INSIGHT_FIELDS,
      level: 'campaign',
      date_preset: datePreset,
      limit: '500',
    }
  )

  const results = data.data || []

  // Fallback: if requested preset returns empty and it's not already 'maximum',
  // retry with 'maximum' to get historical data
  if (results.length === 0 && datePreset !== 'maximum') {
    console.log(`[Meta Ads] No insights for ${datePreset}, falling back to maximum`)
    const fallback = await graphFetch<{ data: MetaInsight[] }>(
      `/${accountId}/insights`,
      {
        fields: INSIGHT_FIELDS,
        level: 'campaign',
        date_preset: 'maximum',
        limit: '500',
      }
    )
    return fallback.data || []
  }

  return results
}

export async function getCampaignInsightsDaily(campaignId: string, datePreset: DatePreset = 'last_7d'): Promise<MetaInsight[]> {
  const dailyFields = INSIGHT_FIELDS + ',date_start,date_stop'

  const data = await graphFetch<{ data: MetaInsight[] }>(
    `/${campaignId}/insights`,
    {
      fields: dailyFields,
      date_preset: datePreset,
      time_increment: '1',
      limit: '100',
    }
  )

  const results = data.data || []

  // Fallback to maximum if empty
  if (results.length === 0 && datePreset !== 'maximum') {
    const fallback = await graphFetch<{ data: MetaInsight[] }>(
      `/${campaignId}/insights`,
      {
        fields: dailyFields,
        date_preset: 'maximum',
        time_increment: '1',
        limit: '100',
      }
    )
    return fallback.data || []
  }

  return results
}

export async function getCampaignsWithMetrics(datePreset: DatePreset = 'last_7d'): Promise<CampaignWithMetrics[]> {
  const [campaigns, insights] = await Promise.all([
    getCampaigns(),
    getCampaignInsightsRaw(datePreset),
  ])

  // Debug logs
  console.log(`[AdPilot Debug] Campaigns fetched: ${campaigns.length}`)
  console.log(`[AdPilot Debug] Insights fetched: ${insights.length} (preset: ${datePreset})`)
  if (insights.length > 0) {
    const totalSpendDebug = insights.reduce((s, i) => s + parseFloat(i.spend || '0'), 0)
    const avgCtrDebug = insights.reduce((s, i) => s + parseFloat(i.ctr || '0'), 0) / insights.length
    console.log(`[AdPilot Debug] Total spend (raw): $${totalSpendDebug.toFixed(2)}`)
    console.log(`[AdPilot Debug] Avg CTR (raw): ${avgCtrDebug.toFixed(2)}%`)
  }

  const days = daysFromPreset(datePreset)

  const insightMap = new Map<string, MetaInsight>()
  for (const i of insights) insightMap.set(i.campaign_id, i)

  const prevInsightMap = new Map<string, MetaInsight>()

  const result = campaigns.map((c): CampaignWithMetrics => {
    const insight = insightMap.get(c.id)
    const prevInsight = prevInsightMap.get(c.id)

    const impressions = parseNum(insight?.impressions)
    const clicks = parseNum(insight?.clicks)
    const spend = parseNum(insight?.spend)
    const reach = parseNum(insight?.reach)
    const frequency = parseNum(insight?.frequency)
    const ctr = parseNum(insight?.ctr)
    const cpc = parseNum(insight?.cpc)
    const cpm = parseNum(insight?.cpm)
    const conversions = extractConversions(insight?.actions)
    const revenue = extractRevenue(insight?.action_values)
    const roas = spend > 0 ? Math.round((revenue / spend) * 100) / 100 : 0
    const cpa = conversions > 0 ? Math.round((spend / conversions) * 100) / 100 : 0

    // Trends vs previous period
    const prevCtr = parseNum(prevInsight?.ctr)
    const prevSpend = parseNum(prevInsight?.spend)
    const prevConversions = extractConversions(prevInsight?.actions)
    const prevRevenue = extractRevenue(prevInsight?.action_values)
    const prevCpa = prevConversions > 0 ? prevSpend / prevConversions : 0
    const prevRoas = prevSpend > 0 ? prevRevenue / prevSpend : 0

    const ctrTrend = prevCtr > 0 ? Math.round(((ctr - prevCtr) / prevCtr) * 100) : 0
    const cpaTrend = prevCpa > 0 ? Math.round(((cpa - prevCpa) / prevCpa) * 100) : 0
    const roasTrend = prevRoas > 0 ? Math.round(((roas - prevRoas) / prevRoas) * 100) : 0

    const objective = mapObjective(c.objective)
    const hasRevenue = revenue > 0
    const classification = classifyCampaign({
      roas, cpa, spend, conversions, ctr, cpc, frequency, days, objective, hasRevenue,
    })

    return {
      id: c.id,
      ad_account_id: process.env.META_AD_ACCOUNT_ID || '',
      name: c.name,
      status: (c.status as any) || 'ACTIVE',
      objective,
      daily_budget: c.daily_budget ? parseNum(c.daily_budget) / 100 : 0, // Meta returns cents
      lifetime_budget: c.lifetime_budget ? parseNum(c.lifetime_budget) / 100 : null,
      delivery_status: mapDeliveryStatus(c.effective_status),
      created_at: c.created_time,
      updated_at: c.updated_time,
      total_spend: spend,
      total_impressions: impressions,
      total_clicks: clicks,
      total_conversions: conversions,
      total_conversion_value: revenue,
      avg_ctr: ctr,
      avg_cpc: cpc,
      avg_cpm: cpm,
      roas,
      cpa,
      avg_frequency: frequency,
      classification,
      ctr_trend: ctrTrend,
      cpa_trend: cpaTrend,
      roas_trend: roasTrend,
      score: 0, // placeholder, calculated below
      recommendation: null as any, // placeholder
      impact: null as any, // placeholder
    }
  })

  // Calculate score and recommendation (needs classification first)
  for (const c of result) {
    const hasRevenue = c.total_conversion_value > 0
    c.score = calculateScore({
      ctr: c.avg_ctr, cpc: c.avg_cpc, spend: c.total_spend,
      conversions: c.total_conversions, frequency: c.avg_frequency,
      roas: c.roas, hasRevenue, classification: c.classification,
    })
    c.recommendation = generateRecommendation({
      classification: c.classification, score: c.score,
      ctr: c.avg_ctr, cpc: c.avg_cpc, frequency: c.avg_frequency,
      spend: c.total_spend, impressions: c.total_impressions,
      clicks: c.total_clicks, conversions: c.total_conversions,
      roas: c.roas, hasRevenue,
    })
    const sim = simulateAction(c)
    c.impact = calculateImpact(c, sim)
  }

  return result
}

export async function getDashboardSummary(datePreset: DatePreset = 'last_7d'): Promise<DashboardSummary> {
  const campaigns = await getCampaignsWithMetrics(datePreset)
  const days = daysFromPreset(datePreset)

  const activeCampaigns = campaigns.filter(c => c.status === 'ACTIVE')
  const totalSpend = campaigns.reduce((s, c) => s + c.total_spend, 0)
  const totalRevenue = campaigns.reduce((s, c) => s + c.total_conversion_value, 0)
  const totalClicks = campaigns.reduce((s, c) => s + c.total_clicks, 0)
  const totalImpressions = campaigns.reduce((s, c) => s + c.total_impressions, 0)

  const losers = campaigns.filter(c => c.classification === 'loser')

  return {
    total_spend: Math.round(totalSpend * 100) / 100,
    total_revenue: Math.round(totalRevenue * 100) / 100,
    overall_roas: totalSpend > 0 ? Math.round((totalRevenue / totalSpend) * 100) / 100 : 0,
    avg_ctr: totalImpressions > 0 ? Math.round(((totalClicks / totalImpressions) * 100) * 100) / 100 : 0,
    avg_cpc: totalClicks > 0 ? Math.round((totalSpend / totalClicks) * 100) / 100 : 0,
    active_campaigns: activeCampaigns.length,
    winning_campaigns: campaigns.filter(c => c.classification === 'winner').length,
    losing_campaigns: losers.length,
    at_risk_campaigns: campaigns.filter(c => c.classification === 'at_risk').length,
    daily_loss: losers.length > 0
      ? Math.round((losers.reduce((s, c) => s + c.total_spend, 0) / days) * 100) / 100
      : 0,
    top_campaigns: campaigns
      .filter(c => c.classification === 'winner')
      .sort((a, b) => {
        // Sort by ROAS if available, otherwise by CTR
        if (a.roas > 0 || b.roas > 0) return b.roas - a.roas
        return b.avg_ctr - a.avg_ctr
      })
      .slice(0, 3),
    worst_campaigns: campaigns
      .filter(c => c.classification === 'loser' || c.classification === 'at_risk')
      .sort((a, b) => a.avg_ctr - b.avg_ctr)
      .slice(0, 3),
  }
}

// ─── Daily Priorities ───

function generateDailyPriorities(campaigns: CampaignWithMetrics[]): DailyPriority[] {
  const priorities: DailyPriority[] = []

  for (const c of campaigns) {
    if (c.total_spend === 0 && c.classification === 'new') continue
    const p = c.recommendation.priority
    if (p === 'urgent' || p === 'opportunity' || p === 'risk') {
      priorities.push({
        type: p === 'urgent' ? 'urgent' : p === 'opportunity' ? 'opportunity' : 'risk',
        campaign_name: c.name,
        message: c.recommendation.reason,
        action: c.recommendation.action,
        impact_value: c.impact?.value || 0,
        impact_description: c.impact?.description || '',
      })
    }
  }

  // Sort by impact value DESC within priority tiers
  const tierOrder = { urgent: 0, risk: 1, opportunity: 2, watch: 3 }
  priorities.sort((a, b) => {
    const tierDiff = tierOrder[a.type] - tierOrder[b.type]
    if (tierDiff !== 0) return tierDiff
    return b.impact_value - a.impact_value
  })
  return priorities.slice(0, 5)
}

function generateTopActions(campaigns: CampaignWithMetrics[]): PriorityAction[] {
  return campaigns
    .filter(c => c.impact && c.impact.value > 0 && c.recommendation.action !== 'WAIT' && c.recommendation.action !== 'MONITOR')
    .map(c => ({
      campaign_id: c.id,
      campaign_name: c.name,
      action: c.recommendation.action,
      impact: c.impact,
      confidence: c.recommendation.confidence,
      reason: c.recommendation.reason,
      score: c.score,
    }))
    .sort((a, b) => b.impact.value - a.impact.value)
    .slice(0, 5)
}

// ─── Daily Action Plan ───

const effortMap: Record<RecommendationAction, EffortLevel> = {
  PAUSE: 'low',
  SCALE: 'low',
  REVIEW_CREATIVE: 'medium',
  REVIEW_TARGETING: 'medium',
  MONITOR: 'low',
  WAIT: 'low',
}

const shortInstructions: Record<RecommendationAction, string> = {
  PAUSE: 'Pausa esta campaña en Ads Manager',
  SCALE: 'Sube el presupuesto 20-25% en Ads Manager',
  REVIEW_CREATIVE: 'Prueba nuevo copy, imagen o video',
  REVIEW_TARGETING: 'Amplía o cambia la audiencia',
  MONITOR: 'Solo observar, sin tocar nada',
  WAIT: 'Dejar correr, aún no hay suficientes datos',
}

const effortMinutes: Record<EffortLevel, number> = { low: 2, medium: 10, high: 20 }

function generateDailyPlan(campaigns: CampaignWithMetrics[]): DailyActionPlan {
  const actionable = campaigns.filter(c =>
    c.impact && c.impact.value > 0 &&
    c.recommendation.action !== 'WAIT' &&
    c.recommendation.action !== 'MONITOR'
  )

  // Sort: urgency tier first, then impact value DESC
  const urgencyOrder: Record<string, number> = { urgent: 0, risk: 1, opportunity: 2, info: 3 }
  actionable.sort((a, b) => {
    const tierDiff = (urgencyOrder[a.recommendation.priority] ?? 3) - (urgencyOrder[b.recommendation.priority] ?? 3)
    if (tierDiff !== 0) return tierDiff
    return b.impact.value - a.impact.value
  })

  const steps: ActionPlanStep[] = actionable.slice(0, 5).map((c, i) => ({
    step: i + 1,
    campaign_id: c.id,
    campaign_name: c.name,
    action: c.recommendation.action,
    label: c.recommendation.label,
    short_instruction: shortInstructions[c.recommendation.action],
    impact_type: c.impact.type,
    impact_value: r2(c.impact.value),
    impact_monthly: r2(c.impact.value * 30),
    confidence: c.recommendation.confidence,
    effort: effortMap[c.recommendation.action],
    reason: c.recommendation.explanation.headline,
    score: c.score,
  }))

  const totalSavings = r2(steps.filter(s => s.impact_type === 'loss_prevention').reduce((s, x) => s + x.impact_value, 0))
  const totalOpportunity = r2(steps.filter(s => s.impact_type === 'opportunity').reduce((s, x) => s + x.impact_value, 0))
  const totalMinutes = steps.reduce((s, x) => s + effortMinutes[x.effort], 0)

  return {
    date: new Date().toISOString().split('T')[0],
    steps,
    total_savings: totalSavings,
    total_opportunity: totalOpportunity,
    total_impact: r2(totalSavings + totalOpportunity),
    execution_time: `~${totalMinutes} min`,
  }
}

export async function getExecutiveSummary(datePreset: DatePreset = 'last_7d'): Promise<ExecutiveSummary> {
  const campaigns = await getCampaignsWithMetrics(datePreset)
  const alerts = generateAlerts(campaigns)
  const days = daysFromPreset(datePreset)

  const totalSpend = campaigns.reduce((s, c) => s + c.total_spend, 0)
  const totalRevenue = campaigns.reduce((s, c) => s + c.total_conversion_value, 0)
  const losers = campaigns.filter(c => c.classification === 'loser')
  const winners = campaigns.filter(c => c.classification === 'winner')

  return {
    date: new Date().toISOString().split('T')[0],
    total_spend: Math.round(totalSpend * 100) / 100,
    total_revenue: Math.round(totalRevenue * 100) / 100,
    overall_roas: totalSpend > 0 ? Math.round((totalRevenue / totalSpend) * 100) / 100 : 0,
    working: winners.map(c => ({
      campaign_name: c.name,
      detail: c.roas > 0
        ? `ROAS ${c.roas}x, ${c.total_conversions} conversiones, $${c.total_spend.toFixed(2)} gastados`
        : `CTR ${c.avg_ctr}%, ${c.total_clicks} clicks, ${c.total_conversions > 0 ? c.total_conversions + ' mensajes, ' : ''}$${c.total_spend.toFixed(2)} gastados`,
    })),
    failing: campaigns
      .filter(c => c.classification === 'loser' || c.classification === 'at_risk')
      .map(c => ({
        campaign_name: c.name,
        detail: c.classification === 'loser'
          ? `$${c.total_spend.toFixed(2)} gastados, ${c.total_conversions} conversiones. CTR ${c.avg_ctr}%`
          : `En riesgo: CTR ${c.avg_ctr}%, CPC $${c.avg_cpc.toFixed(2)}`,
      })),
    actions: alerts.slice(0, 3).map(a => ({
      type: a.type,
      campaign_name: a.campaign_name,
      detail: a.action,
    })),
    priorities: generateDailyPriorities(campaigns),
    top_actions: generateTopActions(campaigns),
    action_plan: generateDailyPlan(campaigns),
    avoidable_loss: losers.length > 0
      ? Math.round((losers.reduce((s, c) => s + c.total_spend, 0) / days) * 100) / 100
      : 0,
    revenue_opportunity: Math.round(
      winners.reduce((s, c) => s + (c.total_conversion_value / days) * 0.25, 0) * 100
    ) / 100,
    total_impact: r2(campaigns.reduce((s, c) => s + (c.impact?.value || 0), 0)),
  }
}

export async function getAlerts(datePreset: DatePreset = 'last_7d'): Promise<Alert[]> {
  const campaigns = await getCampaignsWithMetrics(datePreset)
  return generateAlerts(campaigns)
}

export async function getTopCampaigns(datePreset: DatePreset = 'last_7d', limit = 3): Promise<CampaignWithMetrics[]> {
  const campaigns = await getCampaignsWithMetrics(datePreset)
  return campaigns
    .filter(c => c.total_spend > 0)
    .sort((a, b) => {
      // Sort by ROAS if has conversions, otherwise by CTR
      if (a.roas > 0 || b.roas > 0) return b.roas - a.roas
      return b.avg_ctr - a.avg_ctr
    })
    .slice(0, limit)
}

export async function getWorstCampaigns(datePreset: DatePreset = 'last_7d', limit = 3): Promise<CampaignWithMetrics[]> {
  const campaigns = await getCampaignsWithMetrics(datePreset)
  return campaigns
    .filter(c => c.total_spend > 0)
    .sort((a, b) => {
      if (a.classification === 'loser' && b.classification !== 'loser') return -1
      if (b.classification === 'loser' && a.classification !== 'loser') return 1
      return a.roas - b.roas
    })
    .slice(0, limit)
}

// Public simulation — for chat IA "qué pasa si" questions
export async function simulateCampaignAction(
  campaignName: string,
  action: 'SCALE' | 'PAUSE' | 'REVIEW_CREATIVE' | 'REVIEW_TARGETING',
  datePreset: DatePreset = 'last_7d'
): Promise<{ campaign_name: string; current: Record<string, number>; projected: SimulationResult; recommendation: string } | { error: string }> {
  const campaigns = await getCampaignsWithMetrics(datePreset)
  const campaign = campaigns.find(c => c.name.toLowerCase().includes(campaignName.toLowerCase()))
  if (!campaign) return { error: `Campaña "${campaignName}" no encontrada` }

  // Override recommendation temporarily to simulate desired action
  const original = campaign.recommendation.action
  campaign.recommendation = { ...campaign.recommendation, action }
  const sim = simulateAction(campaign)
  campaign.recommendation = { ...campaign.recommendation, action: original }

  return {
    campaign_name: campaign.name,
    current: {
      spend: campaign.total_spend,
      ctr: campaign.avg_ctr,
      clicks: campaign.total_clicks,
      conversions: campaign.total_conversions,
      cpc: campaign.avg_cpc,
      score: campaign.score,
    },
    projected: sim,
    recommendation: campaign.recommendation.label,
  }
}
