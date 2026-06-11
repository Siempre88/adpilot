// AdPilot — Scoring: Signal[] → Recommendation, plus UI helpers.
// Rule-first: cada Recommendation deriva de Signals determinísticas.

import {
  r2,
  type ActionPlanStep,
  type Alert,
  type AlertSeverity,
  type CampaignClassification,
  type CampaignRecommendation,
  type CampaignWithMetrics,
  type DailyActionPlan,
  type DailyPriority,
  type DecisionType,
  type EffortLevel,
  type ImpactAnalysis,
  type MetricSet,
  type PriorityAction,
  type Recommendation,
  type RecommendationAction,
  type RecommendationConfidence,
  type RecommendationExplanation,
  type RecommendationUrgency,
  type ScoreResult,
  type Signal,
  type SignalType,
  type SimulationResult,
} from './types'

// ─── Signal → Action mapping ───
// Cada SignalType apunta a UNA acción canónica. Si hay múltiples signals,
// gana la de mayor severidad (orden definido más abajo).

const SIGNAL_TO_ACTION: Record<SignalType, RecommendationAction> = {
  zombie_campaign: 'PAUSE',
  landing_problem: 'FIX_LANDING',
  creative_fatigue: 'REVIEW_CREATIVE',
  low_ctr: 'REVIEW_CREATIVE',
  high_cpa: 'REVIEW_TARGETING',
  audience_saturation: 'REVIEW_TARGETING',
  learning_limited: 'REVIEW_TARGETING',
  overspend: 'REDUCE_BUDGET',
  underspend: 'SCALE',
  ready_to_scale: 'SCALE',
}

const SIGNAL_PRIORITY: Record<SignalType, number> = {
  zombie_campaign: 0,         // máxima
  landing_problem: 1,
  creative_fatigue: 2,
  high_cpa: 3,
  low_ctr: 4,
  overspend: 5,
  learning_limited: 6,
  ready_to_scale: 7,
  underspend: 8,
  audience_saturation: 9,
}

const SEVERITY_RANK: Record<AlertSeverity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
}

// ─── Public: Signal[] → Recommendation (Día 3 shape) ───

export function recommendationFromSignals(
  signals: Signal[],
  classification: CampaignClassification,
  metrics: MetricSet,
  score: ScoreResult
): Recommendation {
  if (signals.length === 0) {
    return defaultRecommendation(classification, metrics, score)
  }

  const winner = pickPrimarySignal(signals)
  const action = SIGNAL_TO_ACTION[winner.type]
  const sourceTypes = signals.map(s => s.type)

  return {
    action,
    reason: winner.explanation,
    expectedImpact: {
      type: winner.impact_type,
      value: winner.impact_value,
      description: impactDescription(winner.impact_type, winner.impact_value),
    },
    urgency: urgencyFromSeverity(winner.severity),
    confidence: winner.confidence,
    source_signals: sourceTypes,
  }
}

// ─── Public: Signal[] → CampaignRecommendation (legacy UI shape) ───

export function generateRecommendation(
  signals: Signal[],
  classification: CampaignClassification,
  metrics: MetricSet,
  score: ScoreResult
): CampaignRecommendation {
  const rec = recommendationFromSignals(signals, classification, metrics, score)
  return toCampaignRecommendation(rec, metrics)
}

// ─── Public: Signal[] → Alert[] (legacy UI shape) ───

export function signalsToAlerts(
  signals: Signal[],
  campaign: { id: string; name: string }
): Alert[] {
  const now = new Date().toISOString()
  const alerts: Alert[] = signals.map(s => ({
    id: `alert_${s.type}_${campaign.id}`,
    campaign_id: campaign.id,
    campaign_name: campaign.name,
    type: signalToDecisionType(s.type),
    severity: s.severity,
    problem: s.explanation,
    impact: impactDescription(s.impact_type, s.impact_value),
    action: actionLabel(SIGNAL_TO_ACTION[s.type]),
    is_read: false,
    created_at: now,
  }))
  alerts.sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity])
  return alerts
}

// ─── Helpers ───

function pickPrimarySignal(signals: Signal[]): Signal {
  return [...signals].sort((a, b) => {
    const sevDiff = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]
    if (sevDiff !== 0) return sevDiff
    return SIGNAL_PRIORITY[a.type] - SIGNAL_PRIORITY[b.type]
  })[0]
}

function defaultRecommendation(
  classification: CampaignClassification,
  metrics: MetricSet,
  score: ScoreResult
): Recommendation {
  if (classification === 'no_data') {
    return {
      action: 'WAIT',
      reason: 'Sin datos todavía. Dejar correr al menos $10-15 antes de evaluar.',
      expectedImpact: { type: 'opportunity', value: 0, description: 'Sin impacto estimable' },
      urgency: 'no_rush',
      confidence: 'low',
      source_signals: [],
    }
  }
  if (classification === 'learning' || classification === 'new') {
    return {
      action: 'WAIT',
      reason: `Solo $${metrics.spend.toFixed(2)} gastados. Falta señal para decidir.`,
      expectedImpact: { type: 'opportunity', value: 0, description: 'Esperar datos' },
      urgency: 'no_rush',
      confidence: 'low',
      source_signals: [],
    }
  }
  return {
    action: 'MONITOR',
    reason: `Score ${score.score}/100. Métricas estables. Mantener y revisar en 2-3 días.`,
    expectedImpact: { type: 'opportunity', value: 0, description: 'Sin cambio proyectado' },
    urgency: 'no_rush',
    confidence: score.confidence,
    source_signals: [],
  }
}

function urgencyFromSeverity(s: AlertSeverity): RecommendationUrgency {
  switch (s) {
    case 'critical': return 'now'
    case 'high':     return 'today'
    case 'medium':   return 'this_week'
    case 'low':      return 'no_rush'
  }
}

function impactDescription(type: 'opportunity' | 'loss_prevention', value: number): string {
  if (value <= 0) return 'Sin impacto estimable'
  const monthly = r2(value * 30)
  return type === 'loss_prevention'
    ? `Ahorras $${value.toFixed(2)}/día (~$${monthly.toFixed(0)}/mes)`
    : `+$${value.toFixed(2)}/día (~$${monthly.toFixed(0)}/mes)`
}

function actionLabel(action: RecommendationAction): string {
  return ACTION_LABELS[action]
}

const ACTION_LABELS: Record<RecommendationAction, string> = {
  PAUSE: 'Pausar',
  SCALE: 'Escalar',
  REVIEW_CREATIVE: 'Revisar creativo',
  REVIEW_TARGETING: 'Revisar segmentación',
  FIX_LANDING: 'Revisar landing page',
  REDUCE_BUDGET: 'Reducir presupuesto',
  MONITOR: 'Vigilar',
  WAIT: 'Esperar',
}

function signalToDecisionType(t: SignalType): DecisionType {
  switch (t) {
    case 'zombie_campaign':     return 'PAUSE'
    case 'overspend':           return 'REDUCE_BUDGET'
    case 'ready_to_scale':      return 'SCALE'
    case 'underspend':          return 'SCALE'
    case 'creative_fatigue':    return 'CHANGE_CREATIVE'
    case 'low_ctr':             return 'CHANGE_CREATIVE'
    case 'landing_problem':     return 'CHANGE_CREATIVE'  // closest decision type
    case 'high_cpa':            return 'CHANGE_TARGETING'
    case 'audience_saturation': return 'CHANGE_TARGETING'
    case 'learning_limited':    return 'CHANGE_TARGETING'
  }
}

function toCampaignRecommendation(rec: Recommendation, metrics: MetricSet): CampaignRecommendation {
  const priority: CampaignRecommendation['priority'] =
    rec.urgency === 'now'      ? 'urgent' :
    rec.urgency === 'today'    ? (rec.expectedImpact.type === 'opportunity' ? 'opportunity' : 'risk') :
    rec.urgency === 'this_week' ? 'risk' :
    rec.action === 'SCALE' || rec.action === 'REDUCE_BUDGET' ? 'opportunity' :
    'info'

  const triggerMetrics: string[] = []
  if (metrics.ctr > 0)         triggerMetrics.push(`ctr: ${metrics.ctr.toFixed(2)}%`)
  if (metrics.cpc > 0)         triggerMetrics.push(`cpc: $${metrics.cpc.toFixed(2)}`)
  if (metrics.spend > 0)       triggerMetrics.push(`spend: $${metrics.spend.toFixed(2)}`)
  if (metrics.frequency > 0)   triggerMetrics.push(`freq: ${metrics.frequency.toFixed(1)}`)
  if (metrics.conversions > 0) triggerMetrics.push(`conv: ${metrics.conversions}`)

  const explanation: RecommendationExplanation = {
    headline: explanationHeadline(rec.action, rec.source_signals),
    reason: rec.reason,
    trigger_metrics: triggerMetrics,
  }

  return {
    action: rec.action,
    label: ACTION_LABELS[rec.action],
    reason: rec.reason,
    priority,
    confidence: rec.confidence,
    explanation,
  }
}

function explanationHeadline(action: RecommendationAction, sources: SignalType[]): string {
  if (sources.includes('zombie_campaign'))     return 'Gasto sin retorno'
  if (sources.includes('landing_problem'))     return 'Problema en la landing'
  if (sources.includes('creative_fatigue'))    return 'Fatiga creativa detectada'
  if (sources.includes('low_ctr'))             return 'CTR demasiado bajo'
  if (sources.includes('high_cpa'))            return 'CPA por encima del target'
  if (sources.includes('overspend'))           return 'Gasto desproporcionado'
  if (sources.includes('learning_limited'))    return 'Aprendizaje limitado'
  if (sources.includes('ready_to_scale'))      return 'Listo para escalar'
  if (sources.includes('underspend'))          return 'Ganadora con gasto bajo'
  if (sources.includes('audience_saturation')) return 'Audiencia saturada'
  switch (action) {
    case 'WAIT':    return 'Datos insuficientes'
    case 'MONITOR': return 'Rendimiento aceptable'
    default:        return 'Acción recomendada'
  }
}

// ═══════════════════════════════════════════════════════════
// UI helpers (consumidos por index.ts → Today, Recommendations, etc.)
// Sin cambios respecto a versiones previas — son funciones puras
// que toman CampaignWithMetrics y producen vistas.
// ═══════════════════════════════════════════════════════════

// ─── Simulation & impact ───

export function simulateAction(c: CampaignWithMetrics): SimulationResult {
  const action = c.recommendation.action
  const days = 7
  const dailySpend = c.total_spend > 0 ? c.total_spend / days : c.daily_budget || 0
  const dailyClicks = c.total_clicks / Math.max(days, 1)
  const dailyConv = c.total_conversions / Math.max(days, 1)

  switch (action) {
    case 'SCALE': {
      const factor = 1.25
      const newSpend = dailySpend * factor * days
      const newClicks = Math.round(dailyClicks * factor * days)
      const newConv = Math.round(dailyConv * factor * days)
      return {
        projected_spend: r2(newSpend),
        projected_ctr: c.avg_ctr,
        projected_clicks: newClicks,
        projected_conversions: newConv,
        impact_value: r2(dailySpend * 0.25),
        impact_description: `+$${r2(dailySpend * 0.25)}/día en alcance adicional, ~${Math.round(dailyClicks * 0.25)} clicks más/día`,
      }
    }
    case 'PAUSE':
      return {
        projected_spend: 0,
        projected_ctr: 0,
        projected_clicks: 0,
        projected_conversions: 0,
        impact_value: r2(dailySpend),
        impact_description: `Ahorras $${r2(dailySpend)}/día ($${r2(dailySpend * 30)}/mes)`,
      }
    case 'REDUCE_BUDGET': {
      const reduction = 0.5
      return {
        projected_spend: r2(c.total_spend * reduction),
        projected_ctr: c.avg_ctr,
        projected_clicks: Math.round(c.total_clicks * reduction),
        projected_conversions: Math.round(c.total_conversions * reduction),
        impact_value: r2(dailySpend * 0.5),
        impact_description: `Ahorras $${r2(dailySpend * 0.5)}/día sin perder señal`,
      }
    }
    case 'REVIEW_CREATIVE': {
      const ctrBoost = 1.35
      const newCtr = r2(c.avg_ctr * ctrBoost)
      const newClicks = Math.round(c.total_impressions * (newCtr / 100))
      const clickDiff = newClicks - c.total_clicks
      return {
        projected_spend: c.total_spend,
        projected_ctr: newCtr,
        projected_clicks: newClicks,
        projected_conversions: c.total_conversions > 0 ? Math.round(c.total_conversions * ctrBoost) : 0,
        impact_value: r2(clickDiff > 0 ? clickDiff * (c.avg_cpc > 0 ? c.avg_cpc : 0.01) : dailySpend * 0.3),
        impact_description: `CTR podría subir de ${c.avg_ctr.toFixed(1)}% a ${newCtr}%, +${Math.max(0, clickDiff)} clicks con mismo gasto`,
      }
    }
    case 'REVIEW_TARGETING': {
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
    case 'FIX_LANDING':
      return {
        projected_spend: c.total_spend,
        projected_ctr: c.avg_ctr,
        projected_clicks: c.total_clicks,
        projected_conversions: Math.max(1, Math.round(c.total_clicks * 0.02)),
        impact_value: r2(dailySpend * 0.6),
        impact_description: `Si la landing convierte 2%, recuperas $${r2(dailySpend * 0.6)}/día`,
      }
    default:
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

export function calculateImpact(c: CampaignWithMetrics, sim: SimulationResult): ImpactAnalysis {
  const action = c.recommendation.action
  const confidence = c.recommendation.confidence

  if (action === 'PAUSE' || action === 'REDUCE_BUDGET') {
    return { type: 'loss_prevention', value: r2(sim.impact_value), confidence, description: sim.impact_description }
  }
  if (action === 'SCALE') {
    return { type: 'opportunity', value: r2(sim.impact_value), confidence, description: sim.impact_description }
  }
  if (action === 'REVIEW_CREATIVE' || action === 'REVIEW_TARGETING' || action === 'FIX_LANDING') {
    const isLossPrevention = c.classification === 'loser'
    return {
      type: isLossPrevention ? 'loss_prevention' : 'opportunity',
      value: r2(sim.impact_value),
      confidence,
      description: sim.impact_description,
    }
  }
  return { type: 'opportunity', value: 0, confidence: 'low', description: 'Sin impacto estimable' }
}

// ─── Daily priorities ───

export function generateDailyPriorities(campaigns: CampaignWithMetrics[]): DailyPriority[] {
  const priorities: DailyPriority[] = []

  for (const c of campaigns) {
    if (c.total_spend === 0 && (c.classification === 'learning' || c.classification === 'new' || c.classification === 'no_data')) continue
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

  const tierOrder = { urgent: 0, risk: 1, opportunity: 2, watch: 3 }
  priorities.sort((a, b) => {
    const tierDiff = tierOrder[a.type] - tierOrder[b.type]
    if (tierDiff !== 0) return tierDiff
    return b.impact_value - a.impact_value
  })
  return priorities.slice(0, 5)
}

// ─── Top actions ───

export function generateTopActions(campaigns: CampaignWithMetrics[]): PriorityAction[] {
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

// ─── Daily action plan ───

const effortMap: Record<RecommendationAction, EffortLevel> = {
  PAUSE: 'low',
  SCALE: 'low',
  REDUCE_BUDGET: 'low',
  REVIEW_CREATIVE: 'medium',
  REVIEW_TARGETING: 'medium',
  FIX_LANDING: 'high',
  MONITOR: 'low',
  WAIT: 'low',
}

const shortInstructions: Record<RecommendationAction, string> = {
  PAUSE: 'Pausa esta campaña en Ads Manager',
  SCALE: 'Sube el presupuesto 20-25% en Ads Manager',
  REDUCE_BUDGET: 'Baja el presupuesto a la mitad mientras se diagnostica',
  REVIEW_CREATIVE: 'Prueba nuevo copy, imagen o video',
  REVIEW_TARGETING: 'Amplía o cambia la audiencia',
  FIX_LANDING: 'Revisa la landing: oferta, claridad, velocidad',
  MONITOR: 'Solo observar, sin tocar nada',
  WAIT: 'Dejar correr, aún no hay suficientes datos',
}

const effortMinutes: Record<EffortLevel, number> = { low: 2, medium: 10, high: 20 }

export function generateDailyPlan(campaigns: CampaignWithMetrics[]): DailyActionPlan {
  const actionable = campaigns.filter(
    c => c.impact && c.impact.value > 0 && c.recommendation.action !== 'WAIT' && c.recommendation.action !== 'MONITOR'
  )

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

// Used by the legacy ExecutiveSummary path. New code should consume signals directly.
export function generateAlerts(campaigns: CampaignWithMetrics[], signalsByCampaign?: Map<string, Signal[]>): Alert[] {
  const all: Alert[] = []
  for (const c of campaigns) {
    const sigs = signalsByCampaign?.get(c.id) ?? []
    all.push(...signalsToAlerts(sigs, { id: c.id, name: c.name }))
  }
  all.sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity])
  return all
}
