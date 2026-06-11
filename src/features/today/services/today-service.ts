// AdPilot — Today service.
// Server-only. Lee de Supabase (NUNCA de Meta) y arma el payload Today.
// Si falta setup, devuelve TodayEmpty con razón explícita.

import { createClient } from '@/lib/db/supabase/server'
import type {
  CampaignClassification,
  RecommendationAction,
  RecommendationUrgency,
  SignalSeverity,
  SignalType,
} from '@/shared/types/database'
import type {
  AccountStatus,
  RiskCard,
  TodayAction,
  TodayAiSummary,
  TodayData,
  TodayEmpty,
  TodayHeader,
  TodayResponse,
  WinnerCard,
} from '../types'

const URGENCY_ORDER: Record<RecommendationUrgency, number> = {
  now: 0,
  today: 1,
  this_week: 2,
  no_rush: 3,
}

const SEVERITY_ORDER: Record<SignalSeverity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
}

const r2 = (n: number) => Math.round(n * 100) / 100

// ─── Public ───

export async function getTodayData(userId: string): Promise<TodayResponse> {
  const supabase = await createClient()

  // 1. Empty state: ¿hay conexión Meta?
  const { data: connection } = await supabase
    .from('meta_connections')
    .select('id, token_status')
    .eq('user_id', userId)
    .order('connected_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!connection) {
    return {
      state: 'empty',
      reason: 'no_meta',
      message: 'Conecta tu cuenta de Meta para que AdPilot pueda analizar tus campañas.',
      cta: { label: 'Conectar Meta', action: 'connect_meta' },
    }
  }

  // 2. Empty state: ¿hay datos sincronizados?
  const { data: lastSync } = await supabase
    .from('sync_log')
    .select('completed_at')
    .eq('user_id', userId)
    .eq('status', 'completed')
    .order('completed_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!lastSync) {
    return {
      state: 'empty',
      reason: 'no_sync',
      message: 'Aún no hay datos sincronizados. Sincroniza para empezar a ver tu cuenta.',
      cta: { label: 'Sincronizar ahora', action: 'sync' },
    }
  }

  // 3. Datos del día
  const today = new Date().toISOString().split('T')[0]

  // Cargo en paralelo: campaigns activas, current scores, current signals, current recommendations
  const [campaignsRes, scoresRes, signalsRes, recsRes] = await Promise.all([
    supabase.from('campaigns').select('id, name, daily_budget, objective, status').eq('user_id', userId).eq('is_active', true),
    supabase.from('campaign_scores').select('campaign_id, score, confidence, classification, snapshot_date').eq('user_id', userId).eq('is_current', true),
    supabase.from('campaign_signals').select('campaign_id, signal_type, severity, confidence, explanation, impact_value, impact_type').eq('user_id', userId).eq('is_current', true),
    supabase
      .from('recommendations')
      .select('campaign_id, action, label, score, confidence, impact_value, impact_type, reason')
      .eq('user_id', userId)
      .eq('is_current', true),
  ])

  const campaigns = campaignsRes.data ?? []
  const scores = scoresRes.data ?? []
  const signals = signalsRes.data ?? []
  const recs = recsRes.data ?? []

  // Si la sync corrió pero no hay datos (cero campañas activas) → all_stable como caso degenerado
  if (campaigns.length === 0) {
    return {
      state: 'empty',
      reason: 'no_sync',
      message: 'No hay campañas activas para analizar. Verifica tu cuenta en Meta o sincroniza de nuevo.',
      cta: { label: 'Sincronizar ahora', action: 'sync' },
    }
  }

  // Index por campaign_id
  const campaignsById = new Map(campaigns.map(c => [c.id, c]))
  const scoreById = new Map(scores.map(s => [s.campaign_id, s]))
  const signalsByCampaign = groupBy(signals, s => s.campaign_id)

  // Aggregate insight totals para mostrar spend/revenue/roas/cpa por campaña.
  // (Lectura de ad_insights_daily limitada a últimos 7 días.)
  const insightsByCampaign = await loadInsightTotals(supabase, campaigns.map(c => c.id))

  // ─── Build winners ───
  const winners: WinnerCard[] = []
  for (const c of campaigns) {
    const score = scoreById.get(c.id)
    if (!score) continue
    if (score.classification !== 'winner' && score.classification !== 'healthy') continue

    const totals = insightsByCampaign.get(c.id) ?? emptyTotals()
    winners.push({
      campaign_id: c.id,
      campaign_name: c.name,
      score: score.score,
      classification: score.classification as CampaignClassification,
      spend: totals.spend,
      revenue: totals.revenue,
      roas: totals.roas,
      cpa: totals.cpa,
      ctr: totals.ctr,
      reason: winnerReason(score.classification as CampaignClassification, totals),
    })
  }
  winners.sort((a, b) => {
    if (a.roas > 0 || b.roas > 0) return b.roas - a.roas
    return b.score - a.score
  })

  // ─── Build risks ───
  const risks: RiskCard[] = []
  for (const c of campaigns) {
    const score = scoreById.get(c.id)
    if (!score) continue
    if (score.classification !== 'at_risk' && score.classification !== 'loser') continue

    const camSignals = signalsByCampaign.get(c.id) ?? []
    const primary = camSignals.length > 0
      ? [...camSignals].sort((a, b) => SEVERITY_ORDER[a.severity as SignalSeverity] - SEVERITY_ORDER[b.severity as SignalSeverity])[0]
      : null
    const rec = recs.find(r => r.campaign_id === c.id) ?? null
    const totals = insightsByCampaign.get(c.id) ?? emptyTotals()

    risks.push({
      campaign_id: c.id,
      campaign_name: c.name,
      classification: score.classification as CampaignClassification,
      score: score.score,
      spend: totals.spend,
      primary_signal: primary
        ? { type: primary.signal_type as SignalType, severity: primary.severity as SignalSeverity, explanation: primary.explanation }
        : null,
      signals_count: camSignals.length,
      recommendation_action: (rec?.action as RecommendationAction) ?? null,
      recommendation_short: rec ? shortFromRec(rec.action as RecommendationAction, rec.reason) : 'Revisar y decidir',
    })
  }
  risks.sort((a, b) => {
    const aSev = a.primary_signal ? SEVERITY_ORDER[a.primary_signal.severity] : 99
    const bSev = b.primary_signal ? SEVERITY_ORDER[b.primary_signal.severity] : 99
    if (aSev !== bSev) return aSev - bSev
    return b.spend - a.spend
  })

  // ─── Build actions (top 3 por urgencia + impacto) ───
  const allActions: TodayAction[] = recs
    .filter(r => r.action !== 'WAIT' && r.action !== 'MONITOR')
    .map(r => {
      const camp = campaignsById.get(r.campaign_id)
      return {
        campaign_id: r.campaign_id,
        campaign_name: camp?.name ?? 'Campaña',
        action: r.action as RecommendationAction,
        reason: r.reason,
        impact_value: Number(r.impact_value || 0),
        impact_type: (r.impact_type as 'opportunity' | 'loss_prevention') ?? 'opportunity',
        impact_description: impactDescription(r.impact_type as 'opportunity' | 'loss_prevention', Number(r.impact_value || 0)),
        urgency: urgencyFromAction(r.action as RecommendationAction, signalsByCampaign.get(r.campaign_id)?.[0]?.severity as SignalSeverity | undefined),
        confidence: (r.confidence as 'low' | 'medium' | 'high') ?? 'low',
      }
    })

  allActions.sort((a, b) => {
    const u = URGENCY_ORDER[a.urgency] - URGENCY_ORDER[b.urgency]
    if (u !== 0) return u
    return b.impact_value - a.impact_value
  })

  const actions = allActions.slice(0, 3)
  const totalActions = allActions.length

  // Si NO hay acciones, todo está estable → mostrar empty 'all_stable' con winners
  if (totalActions === 0) {
    return {
      state: 'empty',
      reason: 'all_stable',
      message: 'Todo se ve estable hoy. No hay acciones urgentes.',
      cta: { label: 'Ver todas las campañas', action: 'view_campaigns' },
      winners: winners.slice(0, 3),
    }
  }

  // ─── Header ───
  const avoidableLoss = r2(allActions.filter(a => a.impact_type === 'loss_prevention').reduce((s, a) => s + a.impact_value, 0))
  const revenueOpportunity = r2(allActions.filter(a => a.impact_type === 'opportunity').reduce((s, a) => s + a.impact_value, 0))
  const accountStatus = computeAccountStatus(actions, risks.length, winners.length)

  const header: TodayHeader = {
    date: today,
    total_actions: totalActions,
    visible_actions: actions.length,
    avoidable_loss: avoidableLoss,
    revenue_opportunity: revenueOpportunity,
    account_status: accountStatus,
    account_status_label: accountStatusLabel(accountStatus),
  }

  // ─── AI Summary (rule-based template, voz brutal) ───
  const ai_summary = buildAiSummary({ actions, winners, risks, header })

  const data: TodayData = {
    state: 'loaded',
    header,
    actions,
    winners: winners.slice(0, 3),
    risks: risks.slice(0, 3),
    ai_summary,
  }
  return data
}

// ─── Helpers ───

interface InsightTotals {
  spend: number
  revenue: number
  conversions: number
  clicks: number
  impressions: number
  roas: number
  cpa: number
  ctr: number
}

function emptyTotals(): InsightTotals {
  return { spend: 0, revenue: 0, conversions: 0, clicks: 0, impressions: 0, roas: 0, cpa: 0, ctr: 0 }
}

async function loadInsightTotals(
  supabase: Awaited<ReturnType<typeof createClient>>,
  campaignIds: string[]
): Promise<Map<string, InsightTotals>> {
  if (campaignIds.length === 0) return new Map()

  const { data } = await supabase
    .from('ad_insights_daily')
    .select('campaign_id, spend, conversion_value, conversions, clicks, impressions')
    .in('campaign_id', campaignIds)
    .order('date', { ascending: false })

  const map = new Map<string, InsightTotals>()
  if (!data) return map

  // Aggregate up to last 7 rows per campaign
  const counters = new Map<string, number>()
  for (const row of data) {
    const cid = row.campaign_id as string
    const seen = counters.get(cid) ?? 0
    if (seen >= 7) continue
    counters.set(cid, seen + 1)

    const entry = map.get(cid) ?? emptyTotals()
    entry.spend += Number(row.spend) || 0
    entry.revenue += Number(row.conversion_value) || 0
    entry.conversions += Number(row.conversions) || 0
    entry.clicks += Number(row.clicks) || 0
    entry.impressions += Number(row.impressions) || 0
    map.set(cid, entry)
  }

  for (const [cid, t] of map) {
    t.roas = t.spend > 0 ? r2(t.revenue / t.spend) : 0
    t.cpa = t.conversions > 0 ? r2(t.spend / t.conversions) : 0
    t.ctr = t.impressions > 0 ? r2((t.clicks / t.impressions) * 100) : 0
    t.spend = r2(t.spend)
    t.revenue = r2(t.revenue)
    map.set(cid, t)
  }
  return map
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

function urgencyFromAction(action: RecommendationAction, severity?: SignalSeverity): RecommendationUrgency {
  if (action === 'PAUSE' || action === 'FIX_LANDING') return 'now'
  if (severity === 'critical') return 'now'
  if (severity === 'high') return 'today'
  if (action === 'SCALE') return 'this_week'
  return 'this_week'
}

function impactDescription(type: 'opportunity' | 'loss_prevention', value: number): string {
  if (value <= 0) return 'Sin impacto estimable'
  const monthly = r2(value * 30)
  return type === 'loss_prevention'
    ? `Ahorras $${value.toFixed(2)}/día (~$${monthly.toFixed(0)}/mes)`
    : `+$${value.toFixed(2)}/día (~$${monthly.toFixed(0)}/mes)`
}

function shortFromRec(action: RecommendationAction, reason: string): string {
  // Frase corta verbo-primero (cada insight termina en acción).
  const verb = action === 'PAUSE' ? 'Pausar' :
    action === 'SCALE' ? 'Escalar' :
    action === 'REVIEW_CREATIVE' ? 'Cambiar creativo' :
    action === 'REVIEW_TARGETING' ? 'Revisar segmentación' :
    action === 'FIX_LANDING' ? 'Revisar landing' :
    action === 'REDUCE_BUDGET' ? 'Bajar presupuesto' :
    action === 'WAIT' ? 'Esperar' : 'Vigilar'
  // Truncate reason to keep short
  const shortReason = reason.length > 80 ? reason.slice(0, 77) + '…' : reason
  return `${verb}. ${shortReason}`
}

function winnerReason(classification: CampaignClassification, t: InsightTotals): string {
  if (t.roas >= 3 && t.revenue > 0) return `ROAS ${t.roas.toFixed(1)}x con $${t.spend.toFixed(0)} invertidos.`
  if (t.roas >= 2 && t.revenue > 0) return `ROAS ${t.roas.toFixed(1)}x. Estable.`
  if (t.ctr >= 1.5) return `CTR ${t.ctr.toFixed(1)}% con ${t.clicks} clicks.`
  if (classification === 'healthy') return 'Métricas estables, sin problemas.'
  return `Score alto, eficiencia decente.`
}

function computeAccountStatus(actions: TodayAction[], risksCount: number, winnersCount: number): AccountStatus {
  const hasUrgent = actions.some(a => a.urgency === 'now')
  if (hasUrgent) return 'critical'
  if (risksCount > winnersCount) return 'at_risk'
  if (winnersCount > 0) return 'healthy'
  return 'idle'
}

function accountStatusLabel(s: AccountStatus): string {
  switch (s) {
    case 'critical': return 'Crítico'
    case 'at_risk':  return 'En riesgo'
    case 'healthy':  return 'Saludable'
    case 'idle':     return 'Sin movimiento'
  }
}

function buildAiSummary(input: {
  actions: TodayAction[]
  winners: WinnerCard[]
  risks: RiskCard[]
  header: TodayHeader
}): TodayAiSummary {
  const { actions, winners, risks, header } = input
  const lines: string[] = []

  // Frase 1: estado general
  if (header.account_status === 'critical') {
    lines.push(`Tu cuenta está en zona crítica con ${header.total_actions} acciones pendientes y $${header.avoidable_loss.toFixed(2)}/día en pérdida evitable.`)
  } else if (header.account_status === 'at_risk') {
    lines.push(`Tu cuenta está en riesgo: ${risks.length} campañas con problemas y solo ${winners.length} funcionando bien.`)
  } else if (header.account_status === 'healthy') {
    lines.push(`Tu cuenta está saludable con ${winners.length} campañas funcionando y ${header.total_actions} ajustes para mejorar.`)
  } else {
    lines.push('Cuenta sin movimiento significativo todavía.')
  }

  // Frase 2: la acción más urgente, verbo primero
  const top = actions[0]
  if (top) {
    const verb = actionVerb(top.action)
    lines.push(`Hoy: ${verb} "${top.campaign_name}". ${top.impact_description}.`)
  }

  // Frase 3: oportunidad o segunda acción
  const second = actions[1]
  if (second && top && second.action !== top.action) {
    const verb2 = actionVerb(second.action)
    lines.push(`Después: ${verb2.toLowerCase()} "${second.campaign_name}".`)
  } else if (winners.length > 0 && header.account_status !== 'critical') {
    const w = winners[0]
    lines.push(`"${w.campaign_name}" está imprimiendo ${w.roas > 0 ? `con ROAS ${w.roas.toFixed(1)}x` : `con CTR ${w.ctr.toFixed(1)}%`}. No la toques.`)
  }

  return { text: lines.join(' ') }
}

function actionVerb(a: RecommendationAction): string {
  switch (a) {
    case 'PAUSE':            return 'Pausa'
    case 'SCALE':            return 'Escala'
    case 'REVIEW_CREATIVE':  return 'Cambia el creativo de'
    case 'REVIEW_TARGETING': return 'Revisa la segmentación de'
    case 'FIX_LANDING':      return 'Revisa la landing de'
    case 'REDUCE_BUDGET':    return 'Baja el presupuesto de'
    case 'MONITOR':          return 'Vigila'
    case 'WAIT':             return 'Espera con'
  }
}

// Re-export typed
export type { TodayResponse, TodayData, TodayEmpty } from '../types'
