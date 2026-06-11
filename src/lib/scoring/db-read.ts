// AdPilot — Scoring: lectura DB-first.
// Lee de Supabase (campaigns + insights + scores + signals + recommendations).
// NO recalcula nada: el sync ya corrió el pipeline. Single source of truth para
// consumidores que necesitan CampaignWithMetrics sin pegarle a Meta.

import { createClient } from '@/lib/db/supabase/server'
import type {
  CampaignClassification,
  CampaignRecommendation,
  CampaignStatus,
  CampaignWithMetrics,
  DeliveryStatus,
  ImpactAnalysis,
  ImpactType,
  RecommendationAction,
  RecommendationConfidence,
} from '@/shared/types/database'
import { type DailyInsightRow, metricsFromDailyRows } from './metrics'

const ACTION_LABELS: Record<RecommendationAction, string> = {
  PAUSE: 'Pausar',
  SCALE: 'Escalar',
  REVIEW_CREATIVE: 'Revisar creativo',
  REVIEW_TARGETING: 'Revisar segmentación',
  FIX_LANDING: 'Revisar landing',
  REDUCE_BUDGET: 'Reducir presupuesto',
  MONITOR: 'Vigilar',
  WAIT: 'Esperar',
}

const r2 = (n: number) => Math.round(n * 100) / 100

export async function getCampaignsFromDB(userId: string): Promise<CampaignWithMetrics[]> {
  const supabase = await createClient()

  const [campsRes, scoresRes, recsRes] = await Promise.all([
    supabase.from('campaigns').select('*').eq('user_id', userId).eq('is_active', true).order('name'),
    supabase.from('campaign_scores').select('campaign_id, score, confidence, classification').eq('user_id', userId).eq('is_current', true),
    supabase
      .from('recommendations')
      .select('campaign_id, action, label, confidence, impact_value, impact_type, reason')
      .eq('user_id', userId)
      .eq('is_current', true),
  ])

  const campaigns = campsRes.data ?? []
  if (campaigns.length === 0) return []

  const scoreById = new Map((scoresRes.data ?? []).map(s => [s.campaign_id, s]))
  const recById = new Map((recsRes.data ?? []).map(r => [r.campaign_id, r]))

  // Load insight totals (last 7 days) for each campaign
  const ids = campaigns.map(c => c.id)
  const totalsById = await loadTotals(supabase, ids)

  const out: CampaignWithMetrics[] = campaigns.map(c => {
    const totals = totalsById.get(c.id) ?? emptyTotals()
    const score = scoreById.get(c.id)
    const rec = recById.get(c.id)

    const classification: CampaignClassification = (score?.classification as CampaignClassification) ?? 'no_data'
    const action: RecommendationAction = (rec?.action as RecommendationAction) ?? 'MONITOR'
    const confidence: RecommendationConfidence = (rec?.confidence as RecommendationConfidence) ?? (score?.confidence as RecommendationConfidence) ?? 'low'
    const impactValue = Number(rec?.impact_value ?? 0)
    const impactType: ImpactType = (rec?.impact_type as ImpactType) ?? 'opportunity'

    const recommendation: CampaignRecommendation = {
      action,
      label: rec?.label ?? ACTION_LABELS[action] ?? action,
      reason: rec?.reason ?? '',
      priority: priorityFromAction(action, impactType),
      confidence,
      explanation: { headline: ACTION_LABELS[action] ?? action, reason: rec?.reason ?? '', trigger_metrics: [] },
    }

    const impact: ImpactAnalysis = {
      type: impactType,
      value: impactValue,
      confidence,
      description: impactValue > 0
        ? (impactType === 'loss_prevention'
            ? `Ahorras $${impactValue.toFixed(2)}/día`
            : `+$${impactValue.toFixed(2)}/día`)
        : 'Sin impacto estimable',
    }

    return {
      id: c.id,
      ad_account_id: c.ad_account_id,
      name: c.name,
      status: c.status as CampaignStatus,
      objective: c.objective,
      daily_budget: Number(c.daily_budget) || 0,
      lifetime_budget: c.lifetime_budget != null ? Number(c.lifetime_budget) : null,
      delivery_status: c.delivery_status as DeliveryStatus,
      created_at: c.created_at,
      updated_at: c.updated_at,
      total_spend: totals.spend,
      total_impressions: totals.impressions,
      total_clicks: totals.clicks,
      total_conversions: totals.conversions,
      total_conversion_value: totals.revenue,
      avg_ctr: totals.ctr,
      avg_cpc: totals.cpc,
      avg_cpm: totals.cpm,
      roas: totals.roas,
      cpa: totals.cpa,
      avg_frequency: totals.frequency,
      classification,
      ctr_trend: 0,
      cpa_trend: 0,
      roas_trend: 0,
      score: Number(score?.score ?? 0),
      recommendation,
      impact,
    }
  })

  // Sort by score desc as a sensible default
  out.sort((a, b) => b.score - a.score)
  return out
}

// ─── Helpers ───

function priorityFromAction(action: RecommendationAction, impactType: ImpactType): CampaignRecommendation['priority'] {
  if (action === 'PAUSE' || action === 'FIX_LANDING') return 'urgent'
  if (action === 'SCALE') return 'opportunity'
  if (action === 'REVIEW_CREATIVE' || action === 'REVIEW_TARGETING' || action === 'REDUCE_BUDGET') {
    return impactType === 'loss_prevention' ? 'risk' : 'opportunity'
  }
  return 'info'
}

interface InsightTotals {
  spend: number
  revenue: number
  conversions: number
  clicks: number
  impressions: number
  ctr: number
  cpc: number
  cpm: number
  frequency: number
  roas: number
  cpa: number
}

function emptyTotals(): InsightTotals {
  return {
    spend: 0, revenue: 0, conversions: 0, clicks: 0, impressions: 0,
    ctr: 0, cpc: 0, cpm: 0, frequency: 0, roas: 0, cpa: 0,
  }
}

async function loadTotals(
  supabase: Awaited<ReturnType<typeof createClient>>,
  campaignIds: string[]
): Promise<Map<string, InsightTotals>> {
  const map = new Map<string, InsightTotals>()
  if (campaignIds.length === 0) return map

  const { data } = await supabase
    .from('ad_insights_daily')
    .select('campaign_id, spend, conversion_value, conversions, clicks, impressions, frequency, reach, ctr, cpc, cpm')
    .in('campaign_id', campaignIds)
    .order('date', { ascending: false })

  if (!data) return map

  // Group rows per campaign, keep last 7 dates each
  const rowsByCampaign = new Map<string, DailyInsightRow[]>()
  const counters = new Map<string, number>()
  for (const row of data) {
    const cid = row.campaign_id as string
    const seen = counters.get(cid) ?? 0
    if (seen >= 7) continue
    counters.set(cid, seen + 1)
    const list = rowsByCampaign.get(cid) ?? []
    list.push(row as DailyInsightRow)
    rowsByCampaign.set(cid, list)
  }

  for (const [cid, rows] of rowsByCampaign) {
    const m = metricsFromDailyRows(rows)
    map.set(cid, {
      spend: m.spend,
      revenue: m.revenue,
      conversions: m.conversions,
      clicks: m.clicks,
      impressions: m.impressions,
      ctr: m.ctr,
      cpc: m.cpc,
      cpm: m.cpm,
      frequency: m.frequency,
      roas: m.roas,
      cpa: m.cpa,
    })
  }
  return map
}
