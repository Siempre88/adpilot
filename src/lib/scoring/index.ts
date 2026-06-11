// AdPilot — Scoring facade.
// Pipeline: Meta data → metrics → classify → score → signals → recommendation → CampaignWithMetrics.
// Mantiene la API pública estable para la UI existente.

import { getCampaigns, getCampaignInsightsRaw } from '@/lib/meta/client'
import { daysFromPreset, mapDeliveryStatus, mapObjective, parseNum } from '@/lib/meta/transform'
import type { DatePreset, MetaInsight } from '@/lib/meta/types'

import { classifyCampaign } from './classify'
import { metricsFromMetaInsight } from './metrics'
import {
  calculateImpact,
  generateDailyPlan,
  generateDailyPriorities,
  generateRecommendation,
  generateTopActions,
  signalsToAlerts,
  simulateAction,
} from './recommendations'
import { calculateScore } from './score'
import { detectSignals } from './signals'
import {
  r2,
  type Alert,
  type CampaignWithMetrics,
  type DashboardSummary,
  type ExecutiveSummary,
  type MetricSet,
  type Signal,
  type SimulationResult,
} from './types'

// ─── Pipeline single-campaign result ───
// Útil internamente para sync (persistir scores + signals).

export interface CampaignAnalysis {
  campaign: CampaignWithMetrics
  metrics: MetricSet
  signals: Signal[]
}

// ─── Public: get campaigns enriched with metrics + score + recommendation ───

export async function getCampaignsWithMetrics(
  datePreset: DatePreset = 'last_7d'
): Promise<CampaignWithMetrics[]> {
  const analyses = await analyzeCampaigns(datePreset)
  return analyses.map(a => a.campaign)
}

export async function analyzeCampaigns(
  datePreset: DatePreset = 'last_7d'
): Promise<CampaignAnalysis[]> {
  const [campaigns, insights] = await Promise.all([getCampaigns(), getCampaignInsightsRaw(datePreset)])

  console.log(`[AdPilot] Campaigns: ${campaigns.length}, insights: ${insights.length} (${datePreset})`)

  const days = daysFromPreset(datePreset)
  const insightMap = new Map<string, MetaInsight>()
  for (const i of insights) insightMap.set(i.campaign_id, i)

  const result: CampaignAnalysis[] = campaigns.map(c => {
    const insight = insightMap.get(c.id)
    const metrics = metricsFromMetaInsight(insight, days)
    const classification = classifyCampaign(metrics)
    const score = calculateScore(metrics, classification)
    const signals = detectSignals({ metrics, classification, score })

    const partial: CampaignWithMetrics = {
      id: c.id,
      ad_account_id: process.env.META_AD_ACCOUNT_ID || '',
      name: c.name,
      status: (c.status as CampaignWithMetrics['status']) || 'ACTIVE',
      objective: mapObjective(c.objective) as CampaignWithMetrics['objective'],
      daily_budget: c.daily_budget ? parseNum(c.daily_budget) / 100 : 0,
      lifetime_budget: c.lifetime_budget ? parseNum(c.lifetime_budget) / 100 : null,
      delivery_status: mapDeliveryStatus(c.effective_status) as CampaignWithMetrics['delivery_status'],
      created_at: c.created_time,
      updated_at: c.updated_time,
      total_spend: metrics.spend,
      total_impressions: metrics.impressions,
      total_clicks: metrics.clicks,
      total_conversions: metrics.conversions,
      total_conversion_value: metrics.revenue,
      avg_ctr: metrics.ctr,
      avg_cpc: metrics.cpc,
      avg_cpm: metrics.cpm,
      roas: metrics.roas,
      cpa: metrics.cpa,
      avg_frequency: metrics.frequency,
      classification,
      ctr_trend: 0,
      cpa_trend: 0,
      roas_trend: 0,
      score: score.score,
      recommendation: generateRecommendation(signals, classification, metrics, score),
      impact: null as unknown as CampaignWithMetrics['impact'],
    }

    // Impact depende de simulateAction(c) — necesita el shape ya armado
    const sim = simulateAction(partial)
    partial.impact = calculateImpact(partial, sim)

    return { campaign: partial, metrics, signals }
  })

  return result
}

// ─── Public: dashboard summary ───

export async function getDashboardSummary(
  datePreset: DatePreset = 'last_7d'
): Promise<DashboardSummary> {
  const campaigns = await getCampaignsWithMetrics(datePreset)
  const days = daysFromPreset(datePreset)

  const activeCampaigns = campaigns.filter(c => c.status === 'ACTIVE')
  const totalSpend = campaigns.reduce((s, c) => s + c.total_spend, 0)
  const totalRevenue = campaigns.reduce((s, c) => s + c.total_conversion_value, 0)
  const totalClicks = campaigns.reduce((s, c) => s + c.total_clicks, 0)
  const totalImpressions = campaigns.reduce((s, c) => s + c.total_impressions, 0)
  const losers = campaigns.filter(c => c.classification === 'loser')

  return {
    total_spend: r2(totalSpend),
    total_revenue: r2(totalRevenue),
    overall_roas: totalSpend > 0 ? r2(totalRevenue / totalSpend) : 0,
    avg_ctr: totalImpressions > 0 ? r2((totalClicks / totalImpressions) * 100) : 0,
    avg_cpc: totalClicks > 0 ? r2(totalSpend / totalClicks) : 0,
    active_campaigns: activeCampaigns.length,
    winning_campaigns: campaigns.filter(c => c.classification === 'winner' || c.classification === 'healthy').length,
    losing_campaigns: losers.length,
    at_risk_campaigns: campaigns.filter(c => c.classification === 'at_risk').length,
    daily_loss: losers.length > 0 ? r2(losers.reduce((s, c) => s + c.total_spend, 0) / days) : 0,
    top_campaigns: campaigns
      .filter(c => c.classification === 'winner' || c.classification === 'healthy')
      .sort((a, b) => {
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

// ─── Public: executive summary (legacy ExecutiveSummary shape, for chat IA) ───

export async function getExecutiveSummary(
  datePreset: DatePreset = 'last_7d'
): Promise<ExecutiveSummary> {
  const analyses = await analyzeCampaigns(datePreset)
  const campaigns = analyses.map(a => a.campaign)
  const days = daysFromPreset(datePreset)

  // Build alerts from signals
  const signalsByCampaign = new Map<string, Signal[]>()
  for (const a of analyses) signalsByCampaign.set(a.campaign.id, a.signals)
  const alerts: Alert[] = []
  for (const a of analyses) {
    alerts.push(...signalsToAlerts(a.signals, { id: a.campaign.id, name: a.campaign.name }))
  }

  const totalSpend = campaigns.reduce((s, c) => s + c.total_spend, 0)
  const totalRevenue = campaigns.reduce((s, c) => s + c.total_conversion_value, 0)
  const losers = campaigns.filter(c => c.classification === 'loser')
  const winners = campaigns.filter(c => c.classification === 'winner' || c.classification === 'healthy')

  return {
    date: new Date().toISOString().split('T')[0],
    total_spend: r2(totalSpend),
    total_revenue: r2(totalRevenue),
    overall_roas: totalSpend > 0 ? r2(totalRevenue / totalSpend) : 0,
    working: winners.map(c => ({
      campaign_name: c.name,
      detail:
        c.roas > 0
          ? `ROAS ${c.roas}x, ${c.total_conversions} conversiones, $${c.total_spend.toFixed(2)} gastados`
          : `CTR ${c.avg_ctr}%, ${c.total_clicks} clicks, ${
              c.total_conversions > 0 ? `${c.total_conversions} mensajes, ` : ''
            }$${c.total_spend.toFixed(2)} gastados`,
    })),
    failing: campaigns
      .filter(c => c.classification === 'loser' || c.classification === 'at_risk')
      .map(c => ({
        campaign_name: c.name,
        detail:
          c.classification === 'loser'
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
    avoidable_loss: losers.length > 0 ? r2(losers.reduce((s, c) => s + c.total_spend, 0) / days) : 0,
    revenue_opportunity: r2(winners.reduce((s, c) => s + (c.total_conversion_value / days) * 0.25, 0)),
    total_impact: r2(campaigns.reduce((s, c) => s + (c.impact?.value || 0), 0)),
  }
}

export async function getAlerts(datePreset: DatePreset = 'last_7d'): Promise<Alert[]> {
  const analyses = await analyzeCampaigns(datePreset)
  const all: Alert[] = []
  for (const a of analyses) {
    all.push(...signalsToAlerts(a.signals, { id: a.campaign.id, name: a.campaign.name }))
  }
  return all
}

export async function getTopCampaigns(
  datePreset: DatePreset = 'last_7d',
  limit = 3
): Promise<CampaignWithMetrics[]> {
  const campaigns = await getCampaignsWithMetrics(datePreset)
  return campaigns
    .filter(c => c.total_spend > 0)
    .sort((a, b) => {
      if (a.roas > 0 || b.roas > 0) return b.roas - a.roas
      return b.avg_ctr - a.avg_ctr
    })
    .slice(0, limit)
}

export async function getWorstCampaigns(
  datePreset: DatePreset = 'last_7d',
  limit = 3
): Promise<CampaignWithMetrics[]> {
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

export async function simulateCampaignAction(
  campaignName: string,
  action: 'SCALE' | 'PAUSE' | 'REVIEW_CREATIVE' | 'REVIEW_TARGETING',
  datePreset: DatePreset = 'last_7d'
): Promise<
  | { campaign_name: string; current: Record<string, number>; projected: SimulationResult; recommendation: string }
  | { error: string }
> {
  const campaigns = await getCampaignsWithMetrics(datePreset)
  const campaign = campaigns.find(c => c.name.toLowerCase().includes(campaignName.toLowerCase()))
  if (!campaign) return { error: `Campaña "${campaignName}" no encontrada` }

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
