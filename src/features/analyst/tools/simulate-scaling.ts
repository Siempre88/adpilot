// AdPilot — Analyst tool: simulateScaling.
// Simulación determinística sobre métricas reales: NO usa el LLM, NO inventa.
// Soporta: SCALE_UP, PAUSE, REDUCE_BUDGET sobre una campaña concreta o agregado.

import { createClient } from '@/lib/db/supabase/server'
import { type DailyInsightRow, metricsFromDailyRows } from '@/lib/scoring/metrics'

export type SimulationAction = 'SCALE_UP' | 'PAUSE' | 'REDUCE_BUDGET'

export interface SimulationResult {
  campaign_id: string | null
  campaign_name: string | null
  action: SimulationAction
  current: { daily_spend: number; daily_revenue: number; daily_conversions: number }
  projected: { daily_spend: number; daily_revenue: number; daily_conversions: number }
  impact_value_per_day: number
  impact_type: 'opportunity' | 'loss_prevention'
  description: string
}

const r2 = (n: number) => Math.round(n * 100) / 100

export async function simulateScaling(
  userId: string,
  opts: { campaignId?: string; campaignName?: string; action: SimulationAction; pct?: number }
): Promise<SimulationResult | { error: string }> {
  const supabase = await createClient()

  // Resolve target
  let campaignId: string | null = opts.campaignId ?? null
  let campaignName: string | null = null

  if (!campaignId && opts.campaignName) {
    const { data: matches } = await supabase
      .from('campaigns')
      .select('id, name')
      .eq('user_id', userId)
      .ilike('name', `%${opts.campaignName}%`)
      .limit(1)
    if (matches && matches.length > 0) {
      campaignId = matches[0].id as string
      campaignName = matches[0].name as string
    } else {
      return { error: `No encontré una campaña que coincida con "${opts.campaignName}"` }
    }
  } else if (campaignId) {
    const { data: c } = await supabase
      .from('campaigns')
      .select('name')
      .eq('user_id', userId)
      .eq('id', campaignId)
      .maybeSingle()
    campaignName = (c?.name as string) ?? null
  }

  // Load last 7 days of insights
  let rows: DailyInsightRow[] = []
  if (campaignId) {
    const { data } = await supabase
      .from('ad_insights_daily')
      .select('spend, conversion_value, conversions, clicks, impressions, frequency, reach, ctr, cpc, cpm')
      .eq('campaign_id', campaignId)
      .order('date', { ascending: false })
      .limit(7)
    rows = (data ?? []) as DailyInsightRow[]
  } else {
    // Aggregate across active campaigns
    const { data: campaigns } = await supabase
      .from('campaigns')
      .select('id')
      .eq('user_id', userId)
      .eq('is_active', true)
    const ids = (campaigns ?? []).map(c => c.id as string)
    if (ids.length === 0) return { error: 'Sin campañas activas para simular' }

    const { data } = await supabase
      .from('ad_insights_daily')
      .select('campaign_id, date, spend, conversion_value, conversions, clicks, impressions, frequency, reach, ctr, cpc, cpm')
      .in('campaign_id', ids)
      .order('date', { ascending: false })
      .limit(ids.length * 7)
    rows = (data ?? []) as DailyInsightRow[]
  }

  if (rows.length === 0) return { error: 'Sin datos suficientes para simular' }

  const totals = metricsFromDailyRows(rows)
  const days = Math.max(totals.daysCovered, 1)
  const dailySpend = totals.spend / days
  const dailyRevenue = totals.revenue / days
  const dailyConv = totals.conversions / days

  const action = opts.action
  const pct = typeof opts.pct === 'number' ? opts.pct : (action === 'SCALE_UP' ? 20 : action === 'REDUCE_BUDGET' ? -50 : -100)
  const factor = 1 + pct / 100

  const projSpend = action === 'PAUSE' ? 0 : dailySpend * factor
  // Asume eficiencia constante (ROAS y conv/spend estables)
  const projRevenue = action === 'PAUSE' ? 0 : dailyRevenue * factor
  const projConv = action === 'PAUSE' ? 0 : dailyConv * factor

  let impactValue = 0
  let impactType: 'opportunity' | 'loss_prevention' = 'opportunity'
  let description = ''

  if (action === 'PAUSE') {
    impactValue = r2(dailySpend)
    impactType = 'loss_prevention'
    description = `Ahorras $${impactValue.toFixed(2)}/día (~$${(impactValue * 30).toFixed(0)}/mes). Cero spend, cero conversiones.`
  } else if (action === 'SCALE_UP') {
    impactValue = r2(dailySpend * (pct / 100))
    impactType = 'opportunity'
    const extraConv = projConv - dailyConv
    description = `+$${impactValue.toFixed(2)}/día de spend adicional. Si la eficiencia se mantiene: +${extraConv.toFixed(1)} conv/día.`
  } else if (action === 'REDUCE_BUDGET') {
    impactValue = r2(dailySpend * Math.abs(pct / 100))
    impactType = 'loss_prevention'
    description = `Ahorras $${impactValue.toFixed(2)}/día. Conversiones bajan proporcionalmente — usa solo si la campaña está perdiendo.`
  }

  return {
    campaign_id: campaignId,
    campaign_name: campaignName,
    action,
    current: {
      daily_spend: r2(dailySpend),
      daily_revenue: r2(dailyRevenue),
      daily_conversions: r2(dailyConv),
    },
    projected: {
      daily_spend: r2(projSpend),
      daily_revenue: r2(projRevenue),
      daily_conversions: r2(projConv),
    },
    impact_value_per_day: impactValue,
    impact_type: impactType,
    description,
  }
}
