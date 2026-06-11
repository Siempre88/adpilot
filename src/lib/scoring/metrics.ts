// AdPilot — Scoring: Metrics Engine.
// Normaliza datos crudos (Meta o Supabase) → MetricSet limpio.
// Función pura. Sin red. Sin nulls. División por cero protegida.

import { extractConversions, extractRevenue, parseNum } from '@/lib/meta/transform'
import type { MetaInsight } from '@/lib/meta/types'
import { DEFAULT_CONFIG } from './config'
import type { MetricSet } from './types'

const r2 = (n: number) => Math.round(n * 100) / 100
const r4 = (n: number) => Math.round(n * 10000) / 10000

// ─── From raw Meta insight ───
// Used during sync (data fresh from Graph API).

export function metricsFromMetaInsight(
  insight: MetaInsight | undefined,
  daysCovered: number
): MetricSet {
  if (!insight) return emptyMetricSet(daysCovered)

  const impressions = parseNum(insight.impressions, 0)
  const clicks = parseNum(insight.clicks, 0)
  const spend = parseNum(insight.spend, 0)
  const reach = parseNum(insight.reach, 0)
  const frequency = parseNum(insight.frequency, 0)
  const ctr = parseNum(insight.ctr, 0)
  const cpc = parseNum(insight.cpc, 0)
  const cpm = parseNum(insight.cpm, 0)
  const conversions = extractConversions(insight.actions)
  const revenue = extractRevenue(insight.action_values)

  return finalize({
    spend,
    impressions,
    clicks,
    reach,
    frequency,
    ctr,
    cpc,
    cpm,
    conversions,
    revenue,
    daysCovered,
  })
}

// ─── From DB rows (ad_insights_daily) ───
// Used when reading persisted history. Row shape mirrors Supabase.

export interface DailyInsightRow {
  spend: number | string
  impressions: number | string
  clicks: number | string
  reach?: number | string
  frequency?: number | string
  ctr?: number | string
  cpc?: number | string
  cpm?: number | string
  conversions?: number | string
  conversion_value?: number | string
}

export function metricsFromDailyRows(rows: DailyInsightRow[]): MetricSet {
  if (rows.length === 0) return emptyMetricSet(0)

  let spend = 0
  let impressions = 0
  let clicks = 0
  let reach = 0
  let conversions = 0
  let revenue = 0
  let freqSum = 0
  let freqCount = 0

  for (const r of rows) {
    spend += Number(r.spend) || 0
    impressions += Number(r.impressions) || 0
    clicks += Number(r.clicks) || 0
    reach += Number(r.reach) || 0
    conversions += Number(r.conversions) || 0
    revenue += Number(r.conversion_value) || 0
    const f = Number(r.frequency) || 0
    if (f > 0) {
      freqSum += f
      freqCount += 1
    }
  }

  // Compute ratios from totals (more accurate than averaging row ratios)
  const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0
  const cpc = clicks > 0 ? spend / clicks : 0
  const cpm = impressions > 0 ? (spend / impressions) * 1000 : 0
  const frequency = freqCount > 0 ? freqSum / freqCount : 0

  return finalize({
    spend,
    impressions,
    clicks,
    reach,
    frequency,
    ctr,
    cpc,
    cpm,
    conversions,
    revenue,
    daysCovered: rows.length,
  })
}

// ─── Helpers ───

interface RawInputs {
  spend: number
  impressions: number
  clicks: number
  reach: number
  frequency: number
  ctr: number
  cpc: number
  cpm: number
  conversions: number
  revenue: number
  daysCovered: number
}

function finalize(m: RawInputs): MetricSet {
  const cpa = m.conversions > 0 ? r2(m.spend / m.conversions) : 0
  const roas = m.spend > 0 ? r2(m.revenue / m.spend) : 0

  return {
    spend: r2(m.spend),
    impressions: Math.round(m.impressions),
    clicks: Math.round(m.clicks),
    reach: Math.round(m.reach),
    ctr: r4(m.ctr),
    cpc: r4(m.cpc),
    cpm: r4(m.cpm),
    frequency: r2(m.frequency),
    conversions: Math.round(m.conversions),
    revenue: r2(m.revenue),
    cpa,
    roas,
    hasRevenue: m.revenue > 0,
    daysCovered: m.daysCovered,
    isNew: m.spend < DEFAULT_CONFIG.newCampaignMaxSpend,
  }
}

export function emptyMetricSet(daysCovered: number): MetricSet {
  return {
    spend: 0,
    impressions: 0,
    clicks: 0,
    reach: 0,
    ctr: 0,
    cpc: 0,
    cpm: 0,
    frequency: 0,
    conversions: 0,
    revenue: 0,
    cpa: 0,
    roas: 0,
    hasRevenue: false,
    daysCovered,
    isNew: true,
  }
}
