// AdPilot — Recommendations service.
// Server-only. Lee de Supabase: recommendations + signals + scores + insights.
// Para cada recomendación arma: card metrics + signals + 4 ventanas temporales.

import { createClient } from '@/lib/db/supabase/server'
import {
  type DailyInsightRow,
  metricsFromDailyRows,
} from '@/lib/scoring/metrics'
import type {
  CampaignClassification,
  RecommendationAction,
  RecommendationConfidence,
  RecommendationUrgency,
  SignalSeverity,
  SignalType,
} from '@/shared/types/database'
import type {
  CardMetrics,
  FilterOption,
  RecommendationDetail,
  RecommendationsData,
  RecommendationsEmpty,
  RecommendationsResponse,
  RecommendationsSummary,
  SignalDisplay,
  WindowSnapshot,
} from '../types'

const SEVERITY_RANK: Record<SignalSeverity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
}

const URGENCY_RANK: Record<RecommendationUrgency, number> = {
  now: 0,
  today: 1,
  this_week: 2,
  no_rush: 3,
}

const ACTION_LABELS: Record<RecommendationAction, string> = {
  PAUSE: 'Pausar',
  SCALE: 'Escalar',
  REVIEW_CREATIVE: 'Cambiar creativo',
  REVIEW_TARGETING: 'Revisar segmentación',
  FIX_LANDING: 'Revisar landing',
  REDUCE_BUDGET: 'Reducir presupuesto',
  MONITOR: 'Vigilar',
  WAIT: 'Esperar',
}

const SIGNAL_LABELS: Record<SignalType, string> = {
  zombie_campaign: 'Campaña zombie',
  creative_fatigue: 'Fatiga creativa',
  high_cpa: 'CPA alto',
  low_ctr: 'CTR bajo',
  ready_to_scale: 'Lista para escalar',
  landing_problem: 'Problema en landing',
  audience_saturation: 'Audiencia saturada',
  overspend: 'Gasto desproporcionado',
  underspend: 'Gasto bajo',
  learning_limited: 'Aprendizaje limitado',
}

// ─── Public ───

export async function getRecommendationsData(userId: string): Promise<RecommendationsResponse> {
  const supabase = await createClient()

  // 1. Empty: no data sync yet
  const { data: lastSync } = await supabase
    .from('sync_log')
    .select('completed_at')
    .eq('user_id', userId)
    .eq('status', 'completed')
    .order('completed_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!lastSync) {
    return emptyNoData()
  }

  // 2. Fetch in parallel
  const [recsRes, signalsRes, scoresRes, campaignsRes] = await Promise.all([
    supabase
      .from('recommendations')
      .select('id, campaign_id, action, label, score, confidence, impact_value, impact_type, reason, snapshot_date, reviewed_at')
      .eq('user_id', userId)
      .eq('is_current', true),
    supabase
      .from('campaign_signals')
      .select('campaign_id, signal_type, severity, confidence, explanation, impact_value, impact_type')
      .eq('user_id', userId)
      .eq('is_current', true),
    supabase
      .from('campaign_scores')
      .select('campaign_id, score, confidence, classification')
      .eq('user_id', userId)
      .eq('is_current', true),
    supabase
      .from('campaigns')
      .select('id, name, daily_budget')
      .eq('user_id', userId)
      .eq('is_active', true),
  ])

  const recs = recsRes.data ?? []
  const signals = signalsRes.data ?? []
  const scores = scoresRes.data ?? []
  const campaigns = campaignsRes.data ?? []

  if (recs.length === 0) {
    return emptyAllStable()
  }

  const campaignsById = new Map(campaigns.map(c => [c.id, c]))
  const scoresByCampaign = new Map(scores.map(s => [s.campaign_id, s]))
  const signalsByCampaign = groupBy(signals, s => s.campaign_id)

  // 3. Load all daily insights for the relevant campaigns at once.
  // We need up to 14 days for window comparisons.
  const campaignIds = recs.map(r => r.campaign_id)
  const insightsByCampaign = await loadInsightRows(supabase, campaignIds)

  // 4. Build details
  const details: RecommendationDetail[] = []
  for (const r of recs) {
    const camp = campaignsById.get(r.campaign_id)
    if (!camp) continue

    const score = scoresByCampaign.get(r.campaign_id)
    const camSignals = signalsByCampaign.get(r.campaign_id) ?? []
    const dailyRows = insightsByCampaign.get(r.campaign_id) ?? []

    const action = r.action as RecommendationAction
    const cardMetrics = buildCardMetrics(dailyRows.slice(0, 7))
    const windows = buildWindows(dailyRows)

    const signalsDisplay: SignalDisplay[] = camSignals.map(s => ({
      type: s.signal_type as SignalType,
      type_label: SIGNAL_LABELS[s.signal_type as SignalType] ?? s.signal_type,
      severity: s.severity as SignalSeverity,
      explanation: s.explanation,
      impact_value: Number(s.impact_value || 0),
      impact_type: s.impact_type as 'opportunity' | 'loss_prevention',
    })).sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity])

    const severity: SignalSeverity = signalsDisplay[0]?.severity ?? severityFromAction(action)
    const urgency: RecommendationUrgency = urgencyFromActionAndSeverity(action, severity)
    const impactValue = Number(r.impact_value || 0)
    const impactType = (r.impact_type as 'opportunity' | 'loss_prevention') ?? 'opportunity'

    const reasoning = buildReasoning({
      campaignName: camp.name,
      action,
      windows,
      signals: signalsDisplay,
      reason: r.reason,
    })

    const detail: RecommendationDetail = {
      id: String(r.id),
      campaign_id: r.campaign_id,
      campaign_name: camp.name,
      classification: (score?.classification as CampaignClassification) ?? 'at_risk',
      score: Number(score?.score ?? r.score ?? 0),
      action,
      action_label: ACTION_LABELS[action] ?? r.label ?? action,
      reason: r.reason ?? '',
      urgency,
      severity,
      confidence: (r.confidence as RecommendationConfidence) ?? 'low',
      impact_value: impactValue,
      impact_type: impactType,
      impact_description: impactDescription(impactType, impactValue),
      metrics: cardMetrics,
      signals_count: signalsDisplay.length,
      reviewed_at: r.reviewed_at as string | null,
      signals: signalsDisplay,
      reasoning,
      next_step: nextStep(action),
      windows,
    }
    details.push(detail)
  }

  // 5. Sort: severity → impact → urgency → confidence
  const CONF_RANK: Record<RecommendationConfidence, number> = { high: 0, medium: 1, low: 2 }
  details.sort((a, b) => {
    const sev = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]
    if (sev !== 0) return sev
    const imp = b.impact_value - a.impact_value
    if (imp !== 0) return imp
    const urg = URGENCY_RANK[a.urgency] - URGENCY_RANK[b.urgency]
    if (urg !== 0) return urg
    return CONF_RANK[a.confidence] - CONF_RANK[b.confidence]
  })

  // 6. Summary + filter counts
  const unreviewed = details.filter(d => !d.reviewed_at)
  const summary: RecommendationsSummary = {
    total: unreviewed.length,
    critical: unreviewed.filter(d => d.severity === 'critical').length,
    scale_opportunities: unreviewed.filter(d => d.action === 'SCALE').length,
    avoidable_loss: r2(unreviewed.filter(d => d.impact_type === 'loss_prevention').reduce((s, d) => s + d.impact_value, 0)),
    revenue_opportunity: r2(unreviewed.filter(d => d.impact_type === 'opportunity').reduce((s, d) => s + d.impact_value, 0)),
  }

  const filters = buildFilters(unreviewed)

  const data: RecommendationsData = {
    state: 'loaded',
    summary,
    filters,
    recommendations: details,
  }
  return data
}

export async function markRecommendationReviewed(
  userId: string,
  recommendationId: string,
  reviewed: boolean
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('recommendations')
    .update({ reviewed_at: reviewed ? new Date().toISOString() : null })
    .eq('id', recommendationId)
    .eq('user_id', userId)

  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

// ─── Helpers ───

function emptyNoData(): RecommendationsEmpty {
  return {
    state: 'empty',
    reason: 'no_data',
    message: 'Aún no hay datos suficientes para generar recomendaciones.',
    cta: { label: 'Sincronizar ahora', action: 'sync' },
  }
}

function emptyAllStable(): RecommendationsEmpty {
  return {
    state: 'empty',
    reason: 'all_stable',
    message: 'Todo se ve estable. No hay acciones urgentes hoy.',
    cta: { label: 'Ver Today', action: 'view_today' },
  }
}

interface DailyRow extends DailyInsightRow {
  date: string
  campaign_id: string
}

async function loadInsightRows(
  supabase: Awaited<ReturnType<typeof createClient>>,
  campaignIds: string[]
): Promise<Map<string, DailyRow[]>> {
  if (campaignIds.length === 0) return new Map()
  const { data } = await supabase
    .from('ad_insights_daily')
    .select('campaign_id, date, spend, conversion_value, conversions, clicks, impressions, ctr, cpc, cpm, frequency, reach')
    .in('campaign_id', campaignIds)
    .order('date', { ascending: false })

  const map = new Map<string, DailyRow[]>()
  if (!data) return map

  for (const row of data) {
    const cid = row.campaign_id as string
    const list = map.get(cid) ?? []
    if (list.length < 14) {
      list.push(row as DailyRow)
      map.set(cid, list)
    }
  }
  return map
}

function buildCardMetrics(rows: DailyRow[]): CardMetrics {
  const m = metricsFromDailyRows(rows)
  return {
    spend: m.spend,
    roas: m.roas,
    cpa: m.cpa,
    ctr: m.ctr,
    frequency: m.frequency,
    conversions: m.conversions,
    hasRevenue: m.hasRevenue,
  }
}

function buildWindows(rows: DailyRow[]): WindowSnapshot[] {
  const windows: { key: WindowSnapshot['window']; days: number }[] = [
    { key: '1d', days: 1 },
    { key: '3d', days: 3 },
    { key: '7d', days: 7 },
    { key: '14d', days: 14 },
  ]
  const out: WindowSnapshot[] = []
  for (const w of windows) {
    const slice = rows.slice(0, w.days)
    if (slice.length === 0) {
      out.push({ window: w.key, spend: 0, ctr: 0, cpc: 0, cpa: 0, roas: 0, conversions: 0, daysCovered: 0 })
      continue
    }
    const m = metricsFromDailyRows(slice)
    out.push({
      window: w.key,
      spend: m.spend,
      ctr: m.ctr,
      cpc: m.cpc,
      cpa: m.cpa,
      roas: m.roas,
      conversions: m.conversions,
      daysCovered: m.daysCovered,
    })
  }
  return out
}

function severityFromAction(a: RecommendationAction): SignalSeverity {
  switch (a) {
    case 'PAUSE':
    case 'FIX_LANDING':
      return 'high'
    case 'REDUCE_BUDGET':
    case 'REVIEW_CREATIVE':
    case 'REVIEW_TARGETING':
      return 'medium'
    case 'SCALE':
    case 'MONITOR':
    case 'WAIT':
      return 'low'
  }
}

function urgencyFromActionAndSeverity(a: RecommendationAction, s: SignalSeverity): RecommendationUrgency {
  if (s === 'critical') return 'now'
  if (a === 'PAUSE' || a === 'FIX_LANDING') return 'now'
  if (s === 'high') return 'today'
  if (a === 'SCALE') return 'this_week'
  if (s === 'medium') return 'this_week'
  return 'no_rush'
}

function impactDescription(type: 'opportunity' | 'loss_prevention', value: number): string {
  if (value <= 0) return 'Sin impacto estimable'
  const monthly = r2(value * 30)
  return type === 'loss_prevention'
    ? `Ahorras $${value.toFixed(2)}/día (~$${monthly.toFixed(0)}/mes)`
    : `+$${value.toFixed(2)}/día (~$${monthly.toFixed(0)}/mes)`
}

function buildReasoning(input: {
  campaignName: string
  action: RecommendationAction
  windows: WindowSnapshot[]
  signals: SignalDisplay[]
  reason: string
}): string {
  const { campaignName, action, windows, signals, reason } = input
  const w7 = windows.find(w => w.window === '7d')
  const w3 = windows.find(w => w.window === '3d')

  const parts: string[] = []

  // Frase 1: contexto + por qué
  if (signals.length > 0) {
    const top = signals[0]
    parts.push(`${campaignName}: ${top.explanation}`)
  } else {
    parts.push(reason || `${campaignName}: ${action}.`)
  }

  // Frase 2: dato concreto si hay window
  if (w7 && w7.daysCovered > 0) {
    if (w7.spend > 0 && w7.conversions === 0) {
      parts.push(`En 7 días gastó $${w7.spend.toFixed(2)} sin conversiones.`)
    } else if (w7.roas > 0) {
      parts.push(`En 7 días: $${w7.spend.toFixed(2)} de spend, ROAS ${w7.roas.toFixed(1)}x.`)
    } else if (w7.ctr > 0) {
      parts.push(`En 7 días: $${w7.spend.toFixed(2)} de spend, CTR ${w7.ctr.toFixed(2)}%.`)
    }
  }

  // Frase 3: tendencia 3d vs 7d si difiere mucho
  if (w3 && w7 && w7.ctr > 0 && w3.daysCovered >= 1) {
    const delta = ((w3.ctr - w7.ctr) / w7.ctr) * 100
    if (Math.abs(delta) >= 15) {
      parts.push(
        delta < 0
          ? `Últimos 3 días: CTR cayó ${Math.abs(delta).toFixed(0)}% vs semana completa.`
          : `Últimos 3 días: CTR subió ${delta.toFixed(0)}% vs semana completa.`
      )
    }
  }

  return parts.join(' ')
}

function nextStep(action: RecommendationAction): string {
  switch (action) {
    case 'PAUSE':
      return 'Entra a Meta Ads Manager → Pausar la campaña. Antes de relanzar revisa oferta y audiencia.'
    case 'SCALE':
      return 'Sube el presupuesto 20-25% en Ads Manager. Monitorea CPA las primeras 48h.'
    case 'REVIEW_CREATIVE':
      return 'Crea 2-3 nuevas variaciones de copy/imagen. Genera ideas en Creative Lab.'
    case 'REVIEW_TARGETING':
      return 'Amplía o cambia la audiencia. Prueba lookalike 1-3% o intereses adyacentes.'
    case 'FIX_LANDING':
      return 'Revisa la landing page: velocidad, claridad de oferta, CTA. Mide rate de conversión por separado.'
    case 'REDUCE_BUDGET':
      return 'Baja el presupuesto a la mitad mientras se diagnostica. Mantén la campaña viva pero con menos pérdida.'
    case 'MONITOR':
      return 'Sin acción. Revisa de nuevo en 2-3 días.'
    case 'WAIT':
      return 'Deja correr. Vuelve cuando haya $10-15 de gasto.'
  }
}

function buildFilters(details: RecommendationDetail[]): FilterOption[] {
  const counts = new Map<RecommendationAction | 'all', number>()
  counts.set('all', details.length)
  for (const d of details) {
    counts.set(d.action, (counts.get(d.action) ?? 0) + 1)
  }
  // Show pills only for actions that have at least one rec, plus 'all'
  const actionOrder: RecommendationAction[] = [
    'PAUSE', 'SCALE', 'REVIEW_CREATIVE', 'REVIEW_TARGETING', 'FIX_LANDING', 'REDUCE_BUDGET', 'MONITOR', 'WAIT',
  ]
  const out: FilterOption[] = [{ key: 'all', label: 'Todas', count: details.length }]
  for (const a of actionOrder) {
    const c = counts.get(a) ?? 0
    if (c === 0) continue
    out.push({ key: a, label: ACTION_LABELS[a], count: c })
  }
  return out
}

function groupBy<T, K>(arr: T[], keyFn: (item: T) => K): Map<K, T[]> {
  const map = new Map<K, T[]>()
  for (const item of arr) {
    const key = keyFn(item)
    const list = map.get(key) ?? []
    list.push(item)
    map.set(key, list)
  }
  return map
}

const r2 = (n: number) => Math.round(n * 100) / 100
