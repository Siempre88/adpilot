// ─────────────────────────────────────────────────────────────
// AdPilot — Sync Service (FASE 2)
// Syncs Meta Ads data to Supabase for persistence + history
// Never blocks UI. Always background. With concurrency lock.
// ─────────────────────────────────────────────────────────────

import { createClient } from '@/lib/supabase/server'
import {
  setRequestCredentials,
  getCampaigns as fetchMetaCampaigns,
  getCampaignInsightsRaw,
} from '@/lib/meta-ads'
import type { CampaignClassification, RecommendationConfidence } from '@/shared/types/database'

const GRAPH_API = 'https://graph.facebook.com/v21.0'

// ─── Concurrency Lock ───
// Prevents 2 syncs running for the same user simultaneously

const activeSyncs = new Map<string, number>() // userId → timestamp
const LOCK_TTL = 3 * 60 * 1000 // 3 minutes

function acquireLock(userId: string): boolean {
  const existing = activeSyncs.get(userId)
  if (existing && Date.now() - existing < LOCK_TTL) return false // locked
  activeSyncs.set(userId, Date.now())
  return true
}

function releaseLock(userId: string) {
  activeSyncs.delete(userId)
}

// ─── Rate Limit ───

const RATE_LIMIT = 5 * 60 * 1000 // 5 minutes between syncs

async function checkRateLimit(userId: string): Promise<{ allowed: boolean; waitSeconds?: number }> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('sync_log')
    .select('completed_at')
    .eq('user_id', userId)
    .eq('status', 'completed')
    .order('completed_at', { ascending: false })
    .limit(1)
    .single()

  if (data?.completed_at) {
    const elapsed = Date.now() - new Date(data.completed_at).getTime()
    if (elapsed < RATE_LIMIT) {
      return { allowed: false, waitSeconds: Math.ceil((RATE_LIMIT - elapsed) / 1000) }
    }
  }
  return { allowed: true }
}

// ─── Check for running sync ───

async function hasActiveSync(userId: string): Promise<boolean> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('sync_log')
    .select('id, started_at')
    .eq('user_id', userId)
    .eq('status', 'started')
    .order('started_at', { ascending: false })
    .limit(1)
    .single()

  if (!data) return false
  // If started more than 3 min ago, it's stuck — allow new sync
  const elapsed = Date.now() - new Date(data.started_at).getTime()
  if (elapsed > LOCK_TTL) {
    // Mark stuck sync as error
    await supabase.from('sync_log').update({ status: 'error', error_message: 'Timeout', completed_at: new Date().toISOString() }).eq('id', data.id)
    return false
  }
  return true
}

// ─── Score Calculation (extracted from meta-ads.ts logic) ───

function calculateScore(ctr: number, cpc: number, spend: number, conversions: number, frequency: number): number {
  const ctrScore = Math.min(30, (ctr / 3) * 30)
  const cpcScore = cpc <= 0.01 ? 20 : cpc <= 0.05 ? 18 : cpc <= 0.50 ? 15 : cpc <= 1.50 ? 10 : cpc <= 3 ? 5 : 0
  const convScore = conversions > 0 ? Math.min(20, (conversions / 10) * 20) : ctr > 3 ? 10 : 0
  const freqScore = frequency <= 1.5 ? 15 : frequency <= 2.0 ? 12 : frequency <= 2.5 ? 8 : frequency <= 3.0 ? 4 : 0
  const spendScore = ctr > 2 ? 10 : 0
  return Math.min(100, Math.round(ctrScore + cpcScore + convScore + freqScore + spendScore))
}

function classifyCampaign(ctr: number, spend: number): CampaignClassification {
  if (spend < 5) return 'new'
  if (ctr >= 1.5) return 'winner'
  if (ctr >= 0.8) return 'at_risk'
  if (spend > 10) return 'loser'
  return 'at_risk'
}

function getConfidence(spend: number, impressions: number, clicks: number): RecommendationConfidence {
  let points = 0
  if (spend >= 5) points++; if (spend >= 15) points++; if (spend >= 30) points++
  if (impressions >= 1000) points++; if (impressions >= 5000) points++; if (impressions >= 10000) points++
  if (clicks >= 50) points++; if (clicks >= 200) points++; if (clicks >= 500) points++
  if (points >= 7) return 'high'
  if (points >= 4) return 'medium'
  return 'low'
}

// ─── Sync Functions ───

async function syncCampaigns(userId: string, token: string, accountId: string): Promise<number> {
  setRequestCredentials(token, accountId)
  const metaCampaigns = await fetchMetaCampaigns()

  const supabase = await createClient()
  const now = new Date().toISOString()
  let synced = 0

  // Ensure ad_account exists
  await supabase.from('ad_accounts').upsert({
    id: accountId, user_id: userId, name: accountId, created_at: now,
  }, { onConflict: 'id' })

  // UPSERT campaigns from Meta
  const metaIds = new Set<string>()
  for (const c of metaCampaigns) {
    metaIds.add(c.id)
    await supabase.from('campaigns').upsert({
      id: c.id,
      ad_account_id: accountId,
      user_id: userId,
      name: c.name,
      status: c.status,
      objective: c.objective || 'OUTCOME_SALES',
      daily_budget: c.daily_budget ? parseFloat(c.daily_budget) / 100 : 0,
      lifetime_budget: c.lifetime_budget ? parseFloat(c.lifetime_budget) / 100 : null,
      delivery_status: c.effective_status || 'ACTIVE',
      sync_status: 'synced',
      last_synced_at: now,
      meta_created_at: c.created_time,
      meta_updated_at: c.updated_time,
      is_active: !['DELETED', 'ARCHIVED'].includes(c.status),
    }, { onConflict: 'id' })
    synced++
  }

  // Mark campaigns not in Meta as inactive (soft delete)
  const { data: dbCampaigns } = await supabase
    .from('campaigns')
    .select('id')
    .eq('user_id', userId)
    .eq('is_active', true)

  if (dbCampaigns) {
    for (const dc of dbCampaigns) {
      if (!metaIds.has(dc.id)) {
        await supabase.from('campaigns').update({ is_active: false, last_synced_at: now }).eq('id', dc.id)
      }
    }
  }

  return synced
}

async function syncInsights(userId: string, token: string, accountId: string): Promise<number> {
  setRequestCredentials(token, accountId)

  // Fetch insights — try last_7d first, fallback to maximum
  let insights = await getCampaignInsightsRaw('last_7d')
  if (insights.length === 0) {
    insights = await getCampaignInsightsRaw('maximum')
  }

  const supabase = await createClient()
  let synced = 0

  for (const i of insights) {
    const spend = parseFloat(i.spend || '0')
    const impressions = parseInt(i.impressions || '0')
    const clicks = parseInt(i.clicks || '0')
    const ctr = parseFloat(i.ctr || '0')
    const cpc = parseFloat(i.cpc || '0')
    const cpm = parseFloat(i.cpm || '0')
    const reach = parseInt(i.reach || '0')
    const frequency = parseFloat(i.frequency || '0')

    // Extract conversions from actions
    let conversions = 0
    if (i.actions) {
      const convTypes = ['purchase', 'lead', 'complete_registration', 'onsite_conversion.messaging_conversation_started_7d']
      for (const a of i.actions) {
        if (convTypes.includes(a.action_type)) conversions += parseInt(a.value || '0')
      }
    }

    let conversionValue = 0
    if (i.action_values) {
      for (const a of i.action_values) {
        if (['purchase', 'omni_purchase'].includes(a.action_type)) conversionValue += parseFloat(a.value || '0')
      }
    }

    const date = i.date_start || new Date().toISOString().split('T')[0]

    const { error } = await supabase.from('ad_insights_daily').upsert({
      campaign_id: i.campaign_id,
      date,
      impressions, clicks, spend: Math.round(spend * 100) / 100,
      reach, frequency: Math.round(frequency * 100) / 100,
      cpc: Math.round(cpc * 10000) / 10000,
      cpm: Math.round(cpm * 10000) / 10000,
      ctr: Math.round(ctr * 10000) / 10000,
      conversions,
      conversion_value: Math.round(conversionValue * 100) / 100,
      cost_per_conversion: conversions > 0 ? Math.round((spend / conversions) * 100) / 100 : 0,
    }, { onConflict: 'campaign_id,date' })

    if (!error) synced++
  }

  return synced
}

async function recalculateRecommendations(userId: string): Promise<void> {
  const supabase = await createClient()
  const today = new Date().toISOString().split('T')[0]

  // Mark previous as not current
  await supabase.from('recommendations').update({ is_current: false }).eq('user_id', userId).eq('is_current', true)

  // Get active campaigns with their latest insights
  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('id, name, status, objective, daily_budget')
    .eq('user_id', userId)
    .eq('is_active', true)

  if (!campaigns) return

  for (const c of campaigns) {
    // Get aggregated insights
    const { data: insights } = await supabase
      .from('ad_insights_daily')
      .select('spend, impressions, clicks, ctr, cpc, conversions, conversion_value, frequency')
      .eq('campaign_id', c.id)
      .order('date', { ascending: false })
      .limit(7)

    if (!insights || insights.length === 0) continue

    const totalSpend = insights.reduce((s, i) => s + Number(i.spend), 0)
    const totalClicks = insights.reduce((s, i) => s + Number(i.clicks), 0)
    const totalImpressions = insights.reduce((s, i) => s + Number(i.impressions), 0)
    const totalConversions = insights.reduce((s, i) => s + Number(i.conversions), 0)
    const avgCtr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0
    const avgCpc = totalClicks > 0 ? totalSpend / totalClicks : 0
    const avgFreq = insights.reduce((s, i) => s + Number(i.frequency), 0) / insights.length

    const score = calculateScore(avgCtr, avgCpc, totalSpend, totalConversions, avgFreq)
    const classification = classifyCampaign(avgCtr, totalSpend)
    const confidence = getConfidence(totalSpend, totalImpressions, totalClicks)

    let action = 'MONITOR'
    let label = 'Vigilar'
    let reason = `Score ${score}/100.`

    if (classification === 'winner' && score >= 70) {
      action = 'SCALE'; label = 'Escalar'; reason = `Score ${score}/100. CTR ${avgCtr.toFixed(1)}%. Escalar 20-25%.`
    } else if (classification === 'loser' && avgCtr < 0.8) {
      action = 'REVIEW_CREATIVE'; label = 'Revisar creativo'; reason = `CTR ${avgCtr.toFixed(2)}% muy bajo.`
    } else if (classification === 'loser' && totalSpend > 20 && totalConversions === 0) {
      action = 'PAUSE'; label = 'Pausar'; reason = `$${totalSpend.toFixed(2)} sin resultados.`
    } else if (classification === 'new') {
      action = 'WAIT'; label = 'Esperar'; reason = 'Datos insuficientes.'
    }

    const impactValue = action === 'PAUSE' ? totalSpend / 7 : action === 'SCALE' ? (totalSpend / 7) * 0.25 : 0

    await supabase.from('recommendations').insert({
      user_id: userId,
      campaign_id: c.id,
      action, label, score, confidence,
      impact_value: Math.round(impactValue * 100) / 100,
      impact_type: action === 'PAUSE' ? 'loss_prevention' : 'opportunity',
      reason,
      snapshot_date: today,
      is_current: true,
    })
  }
}

async function recalculateAlerts(userId: string): Promise<void> {
  const supabase = await createClient()
  const today = new Date().toISOString().split('T')[0]

  // Get current recommendations
  const { data: recs } = await supabase
    .from('recommendations')
    .select('campaign_id, action, label, reason, score, impact_value')
    .eq('user_id', userId)
    .eq('is_current', true)

  if (!recs) return

  // Auto-resolve alerts for campaigns that improved
  const { data: activeAlerts } = await supabase
    .from('alerts')
    .select('id, campaign_id, type')
    .eq('user_id', userId)
    .is('resolved_at', null)

  if (activeAlerts) {
    for (const alert of activeAlerts) {
      const rec = recs.find(r => r.campaign_id === alert.campaign_id)
      // If campaign is now winner or monitor, resolve the alert
      if (rec && (rec.action === 'SCALE' || rec.action === 'MONITOR')) {
        await supabase.from('alerts').update({
          resolved_at: new Date().toISOString(),
          resolved_reason: 'auto',
        }).eq('id', alert.id)
      }
    }
  }

  // Create new alerts for actionable recommendations
  for (const rec of recs) {
    if (rec.action === 'MONITOR' || rec.action === 'WAIT') continue

    // Check if active alert already exists for this campaign+type
    const { data: existing } = await supabase
      .from('alerts')
      .select('id')
      .eq('user_id', userId)
      .eq('campaign_id', rec.campaign_id)
      .is('resolved_at', null)
      .limit(1)

    if (existing && existing.length > 0) continue // Already alerted

    const severity = rec.action === 'PAUSE' ? 'critical' : rec.action === 'REVIEW_CREATIVE' ? 'high' : rec.action === 'SCALE' ? 'low' : 'medium'

    await supabase.from('alerts').insert({
      user_id: userId,
      campaign_id: rec.campaign_id,
      campaign_name: '', // Will be filled from campaign data
      type: rec.action === 'SCALE' ? 'SCALE' : rec.action === 'PAUSE' ? 'PAUSE' : 'CHANGE_CREATIVE',
      severity,
      problem: rec.reason,
      impact: rec.impact_value ? `$${rec.impact_value}/día` : 'Pendiente de evaluación',
      action: rec.label,
      snapshot_date: today,
    })
  }
}

// ─── Public: Full Sync ───

export interface SyncResult {
  ok: boolean
  sync_id?: string
  campaigns_synced: number
  insights_synced: number
  error?: string
}

export async function fullSync(userId: string, token: string, accountId: string): Promise<SyncResult> {
  // Check concurrency
  const isRunning = await hasActiveSync(userId)
  if (isRunning) return { ok: false, campaigns_synced: 0, insights_synced: 0, error: 'Sync ya en progreso' }

  if (!acquireLock(userId)) return { ok: false, campaigns_synced: 0, insights_synced: 0, error: 'Sync bloqueada' }

  const supabase = await createClient()

  // Create sync log
  const { data: logEntry } = await supabase.from('sync_log').insert({
    user_id: userId, sync_type: 'full', status: 'started',
  }).select('id').single()

  const syncId = logEntry?.id

  try {
    const campaignsSynced = await syncCampaigns(userId, token, accountId)
    const insightsSynced = await syncInsights(userId, token, accountId)
    await recalculateRecommendations(userId)
    await recalculateAlerts(userId)

    // FASE 3: Evaluate automation rules + execute auto-approved actions
    try {
      const { evaluateRules } = await import('@/lib/rule-engine')
      const { processApprovedActions } = await import('@/lib/action-executor')
      await evaluateRules(userId)
      await processApprovedActions(userId)
    } catch (ruleErr) {
      console.error('[Sync] Rule engine error (non-blocking):', ruleErr)
    }

    if (syncId) {
      await supabase.from('sync_log').update({
        status: 'completed',
        campaigns_synced: campaignsSynced,
        insights_synced: insightsSynced,
        completed_at: new Date().toISOString(),
      }).eq('id', syncId)
    }

    releaseLock(userId)
    return { ok: true, sync_id: syncId, campaigns_synced: campaignsSynced, insights_synced: insightsSynced }
  } catch (err) {
    if (syncId) {
      await supabase.from('sync_log').update({
        status: 'error',
        error_message: err instanceof Error ? err.message : 'Unknown error',
        completed_at: new Date().toISOString(),
      }).eq('id', syncId)
    }
    releaseLock(userId)
    return { ok: false, sync_id: syncId, campaigns_synced: 0, insights_synced: 0, error: err instanceof Error ? err.message : 'Sync failed' }
  }
}

export async function getSyncStatus(userId: string): Promise<{ last_sync: string | null; stale: boolean; syncing: boolean }> {
  const supabase = await createClient()

  const { data: running } = await supabase
    .from('sync_log')
    .select('id')
    .eq('user_id', userId)
    .eq('status', 'started')
    .limit(1)

  const { data: last } = await supabase
    .from('sync_log')
    .select('completed_at')
    .eq('user_id', userId)
    .eq('status', 'completed')
    .order('completed_at', { ascending: false })
    .limit(1)
    .single()

  const lastSync = last?.completed_at || null
  const stale = !lastSync || (Date.now() - new Date(lastSync).getTime() > 15 * 60 * 1000)

  return { last_sync: lastSync, stale, syncing: (running?.length || 0) > 0 }
}

export async function checkSyncRateLimit(userId: string): Promise<{ allowed: boolean; waitSeconds?: number }> {
  return checkRateLimit(userId)
}
