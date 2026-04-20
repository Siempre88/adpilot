// ─────────────────────────────────────────────────────────────
// AdPilot — Database Queries (FASE 2)
// Reads persisted data from Supabase instead of Meta API
// ─────────────────────────────────────────────────────────────

import { createClient } from '@/lib/supabase/server'
import type {
  CampaignWithMetrics,
  CampaignClassification,
  DashboardSummary,
  ExecutiveSummary,
  Alert,
  DailyActionPlan,
  ActionPlanStep,
} from '@/shared/types/database'

function r2(n: number): number { return Math.round(n * 100) / 100 }

function classify(ctr: number, spend: number): CampaignClassification {
  if (spend < 5) return 'new'
  if (ctr >= 1.5) return 'winner'
  if (ctr >= 0.8) return 'at_risk'
  if (spend > 10) return 'loser'
  return 'at_risk'
}

function calcScore(ctr: number, cpc: number, spend: number, conversions: number, frequency: number): number {
  const s1 = Math.min(30, (ctr / 3) * 30)
  const s2 = cpc <= 0.01 ? 20 : cpc <= 0.05 ? 18 : cpc <= 0.50 ? 15 : cpc <= 1.50 ? 10 : cpc <= 3 ? 5 : 0
  const s3 = conversions > 0 ? Math.min(20, (conversions / 10) * 20) : ctr > 3 ? 10 : 0
  const s4 = frequency <= 1.5 ? 15 : frequency <= 2.0 ? 12 : frequency <= 2.5 ? 8 : frequency <= 3.0 ? 4 : 0
  const s5 = ctr > 2 ? 10 : 0
  const total = Math.round(s1 + s2 + s3 + s4 + s5)
  return Math.min(100, total)
}

// ─── Get campaigns with metrics from DB ───

export async function getCampaignsFromDB(userId: string): Promise<CampaignWithMetrics[]> {
  const supabase = await createClient()

  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('name')

  if (!campaigns || campaigns.length === 0) return []

  const result: CampaignWithMetrics[] = []

  for (const c of campaigns) {
    const { data: insights } = await supabase
      .from('ad_insights_daily')
      .select('*')
      .eq('campaign_id', c.id)
      .order('date', { ascending: false })
      .limit(7)

    const totalSpend = insights?.reduce((s, i) => s + Number(i.spend), 0) || 0
    const totalClicks = insights?.reduce((s, i) => s + Number(i.clicks), 0) || 0
    const totalImpressions = insights?.reduce((s, i) => s + Number(i.impressions), 0) || 0
    const totalConversions = insights?.reduce((s, i) => s + Number(i.conversions), 0) || 0
    const totalConvValue = insights?.reduce((s, i) => s + Number(i.conversion_value), 0) || 0
    const avgFreq = insights && insights.length > 0 ? insights.reduce((s, i) => s + Number(i.frequency), 0) / insights.length : 0
    const avgCtr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0
    const avgCpc = totalClicks > 0 ? totalSpend / totalClicks : 0
    const avgCpm = totalImpressions > 0 ? (totalSpend / totalImpressions) * 1000 : 0
    const roas = totalSpend > 0 ? totalConvValue / totalSpend : 0
    const cpa = totalConversions > 0 ? totalSpend / totalConversions : 0

    const score = calcScore(avgCtr, avgCpc, totalSpend, totalConversions, avgFreq)
    const classification = classify(avgCtr, totalSpend)

    // Get current recommendation from DB
    const { data: rec } = await supabase
      .from('recommendations')
      .select('*')
      .eq('campaign_id', c.id)
      .eq('user_id', userId)
      .eq('is_current', true)
      .limit(1)
      .single()

    const recAction = rec?.action || 'MONITOR'
    const recLabel = rec?.label || 'Vigilar'
    const recReason = rec?.reason || ''
    const confidence = (rec?.confidence || 'low') as any
    const impactValue = Number(rec?.impact_value || 0)

    result.push({
      id: c.id,
      ad_account_id: c.ad_account_id,
      name: c.name,
      status: c.status as any,
      objective: c.objective as any,
      daily_budget: Number(c.daily_budget),
      lifetime_budget: c.lifetime_budget ? Number(c.lifetime_budget) : null,
      delivery_status: c.delivery_status as any,
      created_at: c.created_at,
      updated_at: c.updated_at,
      total_spend: r2(totalSpend),
      total_impressions: totalImpressions,
      total_clicks: totalClicks,
      total_conversions: totalConversions,
      total_conversion_value: r2(totalConvValue),
      avg_ctr: r2(avgCtr),
      avg_cpc: r2(avgCpc),
      avg_cpm: r2(avgCpm),
      roas: r2(roas),
      cpa: r2(cpa),
      avg_frequency: r2(avgFreq),
      classification,
      ctr_trend: 0,
      cpa_trend: 0,
      roas_trend: 0,
      score,
      recommendation: {
        action: recAction as any,
        label: recLabel,
        reason: recReason,
        priority: recAction === 'PAUSE' ? 'urgent' : recAction === 'SCALE' ? 'opportunity' : 'info',
        confidence,
        explanation: { headline: recLabel, reason: recReason, trigger_metrics: [] },
      },
      impact: {
        type: (rec?.impact_type || 'opportunity') as any,
        value: impactValue,
        confidence,
        description: impactValue > 0 ? `$${impactValue.toFixed(2)}/día` : '',
      },
    })
  }

  return result.sort((a, b) => b.score - a.score)
}

export async function getDashboardFromDB(userId: string): Promise<DashboardSummary> {
  const campaigns = await getCampaignsFromDB(userId)

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
    active_campaigns: campaigns.length,
    winning_campaigns: campaigns.filter(c => c.classification === 'winner').length,
    losing_campaigns: losers.length,
    at_risk_campaigns: campaigns.filter(c => c.classification === 'at_risk').length,
    daily_loss: losers.length > 0 ? r2(losers.reduce((s, c) => s + c.total_spend, 0) / 7) : 0,
    top_campaigns: campaigns.filter(c => c.classification === 'winner').slice(0, 3),
    worst_campaigns: campaigns.filter(c => c.classification === 'loser' || c.classification === 'at_risk').sort((a, b) => a.avg_ctr - b.avg_ctr).slice(0, 3),
  }
}

export async function getAlertsFromDB(userId: string): Promise<Alert[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('alerts')
    .select('*')
    .eq('user_id', userId)
    .is('resolved_at', null)
    .order('created_at', { ascending: false })

  return (data || []) as Alert[]
}

export async function getExecutiveFromDB(userId: string): Promise<ExecutiveSummary> {
  const campaigns = await getCampaignsFromDB(userId)
  const alerts = await getAlertsFromDB(userId)
  const winners = campaigns.filter(c => c.classification === 'winner')
  const losers = campaigns.filter(c => c.classification === 'loser')
  const totalSpend = campaigns.reduce((s, c) => s + c.total_spend, 0)
  const totalRevenue = campaigns.reduce((s, c) => s + c.total_conversion_value, 0)

  const steps: ActionPlanStep[] = campaigns
    .filter(c => c.impact.value > 0 && c.recommendation.action !== 'WAIT' && c.recommendation.action !== 'MONITOR')
    .sort((a, b) => b.impact.value - a.impact.value)
    .slice(0, 5)
    .map((c, i) => ({
      step: i + 1,
      campaign_id: c.id,
      campaign_name: c.name,
      action: c.recommendation.action,
      label: c.recommendation.label,
      short_instruction: c.recommendation.action === 'PAUSE' ? 'Pausa esta campaña en Ads Manager'
        : c.recommendation.action === 'SCALE' ? 'Sube el presupuesto 20-25%'
        : c.recommendation.action === 'REVIEW_CREATIVE' ? 'Prueba nuevo copy o imagen'
        : 'Amplía o cambia la audiencia',
      impact_type: c.impact.type,
      impact_value: c.impact.value,
      impact_monthly: r2(c.impact.value * 30),
      confidence: c.recommendation.confidence,
      effort: (c.recommendation.action === 'PAUSE' || c.recommendation.action === 'SCALE' ? 'low' : 'medium') as any,
      reason: c.recommendation.explanation.headline,
      score: c.score,
    }))

  const totalSavings = r2(steps.filter(s => s.impact_type === 'loss_prevention').reduce((s, x) => s + x.impact_value, 0))
  const totalOpp = r2(steps.filter(s => s.impact_type === 'opportunity').reduce((s, x) => s + x.impact_value, 0))

  return {
    date: new Date().toISOString().split('T')[0],
    total_spend: r2(totalSpend),
    total_revenue: r2(totalRevenue),
    overall_roas: totalSpend > 0 ? r2(totalRevenue / totalSpend) : 0,
    working: winners.slice(0, 3).map(c => ({
      campaign_name: c.name,
      detail: `CTR ${c.avg_ctr}%, ${c.total_clicks} clicks, $${c.total_spend.toFixed(2)} gastados`,
    })),
    failing: losers.slice(0, 2).map(c => ({
      campaign_name: c.name,
      detail: `$${c.total_spend.toFixed(2)} gastados, CTR ${c.avg_ctr}%`,
    })),
    actions: alerts.slice(0, 3).map(a => ({ type: a.type as any, campaign_name: a.campaign_name, detail: a.action })),
    priorities: campaigns
      .filter(c => c.recommendation.priority !== 'info')
      .slice(0, 5)
      .map(c => ({
        type: c.recommendation.priority === 'urgent' ? 'urgent' as const : c.recommendation.priority === 'opportunity' ? 'opportunity' as const : 'risk' as const,
        campaign_name: c.name,
        message: c.recommendation.reason,
        action: c.recommendation.action,
        impact_value: c.impact.value,
        impact_description: c.impact.description,
      })),
    top_actions: campaigns
      .filter(c => c.impact.value > 0 && c.recommendation.action !== 'WAIT' && c.recommendation.action !== 'MONITOR')
      .slice(0, 5)
      .map(c => ({
        campaign_id: c.id, campaign_name: c.name, action: c.recommendation.action,
        impact: c.impact, confidence: c.recommendation.confidence, reason: c.recommendation.reason, score: c.score,
      })),
    action_plan: {
      date: new Date().toISOString().split('T')[0],
      steps,
      total_savings: totalSavings,
      total_opportunity: totalOpp,
      total_impact: r2(totalSavings + totalOpp),
      execution_time: `~${steps.reduce((s, x) => s + (x.effort === 'low' ? 2 : 10), 0)} min`,
    },
    avoidable_loss: losers.length > 0 ? r2(losers.reduce((s, c) => s + c.total_spend, 0) / 7) : 0,
    revenue_opportunity: 0,
    total_impact: r2(totalSavings + totalOpp),
  }
}
