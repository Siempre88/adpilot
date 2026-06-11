// AdPilot — Analyst tool: getInsights.
// Devuelve métricas + ventanas temporales (1d / 3d / 7d / 14d) para una campaña.
// Si no se especifica campaignId, devuelve agregado global.

import { createClient } from '@/lib/db/supabase/server'
import { type DailyInsightRow, metricsFromDailyRows } from '@/lib/scoring/metrics'

export interface WindowMetrics {
  window: '1d' | '3d' | '7d' | '14d'
  spend: number
  ctr: number
  cpc: number
  cpa: number
  roas: number
  conversions: number
  days_covered: number
}

export interface InsightSummary {
  campaign_id: string | null
  campaign_name: string | null
  windows: WindowMetrics[]
  trend_note: string  // descripción humana de tendencia 3d vs 7d
}

export async function getInsights(userId: string, opts?: { campaignId?: string }): Promise<InsightSummary> {
  const supabase = await createClient()

  // Resolve campaign IDs
  let targetIds: string[] = []
  let targetName: string | null = null

  if (opts?.campaignId) {
    const { data: c } = await supabase
      .from('campaigns')
      .select('id, name')
      .eq('user_id', userId)
      .eq('id', opts.campaignId)
      .maybeSingle()
    if (!c) {
      return { campaign_id: opts.campaignId, campaign_name: null, windows: emptyWindows(), trend_note: 'Campaña no encontrada' }
    }
    targetIds = [c.id as string]
    targetName = c.name as string
  } else {
    const { data: campaigns } = await supabase
      .from('campaigns')
      .select('id')
      .eq('user_id', userId)
      .eq('is_active', true)
    targetIds = (campaigns ?? []).map(c => c.id as string)
  }

  if (targetIds.length === 0) {
    return { campaign_id: null, campaign_name: null, windows: emptyWindows(), trend_note: 'Sin campañas activas' }
  }

  // Fetch up to 14 days of insights (across selected campaigns)
  const { data } = await supabase
    .from('ad_insights_daily')
    .select('campaign_id, date, spend, conversion_value, conversions, clicks, impressions, ctr, cpc, cpm, frequency, reach')
    .in('campaign_id', targetIds)
    .order('date', { ascending: false })
    .limit(targetIds.length * 14)

  if (!data || data.length === 0) {
    return {
      campaign_id: opts?.campaignId ?? null,
      campaign_name: targetName,
      windows: emptyWindows(),
      trend_note: 'Sin datos de insights todavía',
    }
  }

  const rows = data as (DailyInsightRow & { date: string; campaign_id: string })[]

  // Group by date for window aggregation (across selected campaigns)
  const windows = computeWindows(rows)
  const trendNote = computeTrendNote(windows)

  return {
    campaign_id: opts?.campaignId ?? null,
    campaign_name: targetName,
    windows,
    trend_note: trendNote,
  }
}

function emptyWindows(): WindowMetrics[] {
  const keys: WindowMetrics['window'][] = ['1d', '3d', '7d', '14d']
  return keys.map(w => ({ window: w, spend: 0, ctr: 0, cpc: 0, cpa: 0, roas: 0, conversions: 0, days_covered: 0 }))
}

function computeWindows(rows: (DailyInsightRow & { date: string; campaign_id: string })[]): WindowMetrics[] {
  // Bucket per date so we can take the last N unique dates
  const byDate = new Map<string, (DailyInsightRow & { date: string })[]>()
  for (const r of rows) {
    const key = String(r.date)
    const list = byDate.get(key) ?? []
    list.push(r)
    byDate.set(key, list)
  }
  const dates = [...byDate.keys()].sort().reverse()

  const windowDays: { key: WindowMetrics['window']; n: number }[] = [
    { key: '1d', n: 1 }, { key: '3d', n: 3 }, { key: '7d', n: 7 }, { key: '14d', n: 14 },
  ]

  return windowDays.map(w => {
    const slice = dates.slice(0, w.n).flatMap(d => byDate.get(d) ?? [])
    if (slice.length === 0) {
      return { window: w.key, spend: 0, ctr: 0, cpc: 0, cpa: 0, roas: 0, conversions: 0, days_covered: 0 }
    }
    const m = metricsFromDailyRows(slice)
    return {
      window: w.key,
      spend: m.spend,
      ctr: m.ctr,
      cpc: m.cpc,
      cpa: m.cpa,
      roas: m.roas,
      conversions: m.conversions,
      days_covered: Math.min(w.n, dates.length),
    }
  })
}

function computeTrendNote(windows: WindowMetrics[]): string {
  const w3 = windows.find(w => w.window === '3d')
  const w7 = windows.find(w => w.window === '7d')
  if (!w3 || !w7 || w7.ctr === 0) return 'Sin tendencia clara todavía'

  const ctrDelta = ((w3.ctr - w7.ctr) / w7.ctr) * 100
  const roasDelta = w7.roas > 0 ? ((w3.roas - w7.roas) / w7.roas) * 100 : 0

  if (Math.abs(ctrDelta) >= 15) {
    return ctrDelta < 0
      ? `Últimos 3 días: CTR cayó ${Math.abs(ctrDelta).toFixed(0)}% vs semana completa.`
      : `Últimos 3 días: CTR subió ${ctrDelta.toFixed(0)}% vs semana completa.`
  }
  if (Math.abs(roasDelta) >= 15) {
    return roasDelta < 0
      ? `Últimos 3 días: ROAS bajó ${Math.abs(roasDelta).toFixed(0)}%.`
      : `Últimos 3 días: ROAS subió ${roasDelta.toFixed(0)}%.`
  }
  return 'Métricas estables vs últimos 7 días'
}
