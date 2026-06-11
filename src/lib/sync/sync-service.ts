// ─────────────────────────────────────────────────────────────
// AdPilot — Sync Service
// Pipeline: Meta → Supabase raw → Metrics Engine → scores/signals/recommendations
// Idempotente. Concurrency lock. Rate limit. No bloquea UI.
// ─────────────────────────────────────────────────────────────

import { createClient } from '@/lib/db/supabase/server'
import {
  setRequestCredentials,
  getCampaigns as fetchMetaCampaigns,
  getCampaignInsightsRaw,
} from '@/lib/meta/client'
import { classifyCampaign } from '@/lib/scoring/classify'
import { metricsFromDailyRows, type DailyInsightRow } from '@/lib/scoring/metrics'
import { recommendationFromSignals } from '@/lib/scoring/recommendations'
import { calculateScore } from '@/lib/scoring/score'
import { detectSignals } from '@/lib/scoring/signals'

// ─── Concurrency Lock ───
const activeSyncs = new Map<string, number>()
const LOCK_TTL = 3 * 60 * 1000 // 3 minutes

function acquireLock(userId: string): boolean {
  const existing = activeSyncs.get(userId)
  if (existing && Date.now() - existing < LOCK_TTL) return false
  activeSyncs.set(userId, Date.now())
  return true
}

function releaseLock(userId: string) {
  activeSyncs.delete(userId)
}

// ─── Rate Limit ───
const RATE_LIMIT = 5 * 60 * 1000

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
  const elapsed = Date.now() - new Date(data.started_at).getTime()
  if (elapsed > LOCK_TTL) {
    await supabase
      .from('sync_log')
      .update({ status: 'error', error_message: 'Timeout', completed_at: new Date().toISOString() })
      .eq('id', data.id)
    return false
  }
  return true
}

// ─── Step 1: Sync raw campaigns from Meta ───

async function syncCampaigns(userId: string, token: string, accountId: string): Promise<number> {
  setRequestCredentials(token, accountId)
  const metaCampaigns = await fetchMetaCampaigns()

  const supabase = await createClient()
  const now = new Date().toISOString()
  let synced = 0

  await supabase
    .from('ad_accounts')
    .upsert({ id: accountId, user_id: userId, name: accountId, created_at: now }, { onConflict: 'id' })

  const metaIds = new Set<string>()
  for (const c of metaCampaigns) {
    metaIds.add(c.id)
    await supabase.from('campaigns').upsert(
      {
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
        is_active: c.status === 'ACTIVE',
      },
      { onConflict: 'id' }
    )
    synced++
  }

  // Soft-delete campaigns no longer in Meta
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

// ─── Step 2: Sync raw insights from Meta ───

async function syncInsights(userId: string, token: string, accountId: string): Promise<number> {
  setRequestCredentials(token, accountId)

  let insights = await getCampaignInsightsRaw('last_7d')
  if (insights.length === 0) insights = await getCampaignInsightsRaw('maximum')

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

    const { error } = await supabase.from('ad_insights_daily').upsert(
      {
        campaign_id: i.campaign_id,
        date,
        impressions,
        clicks,
        spend: Math.round(spend * 100) / 100,
        reach,
        frequency: Math.round(frequency * 100) / 100,
        cpc: Math.round(cpc * 10000) / 10000,
        cpm: Math.round(cpm * 10000) / 10000,
        ctr: Math.round(ctr * 10000) / 10000,
        conversions,
        conversion_value: Math.round(conversionValue * 100) / 100,
        cost_per_conversion: conversions > 0 ? Math.round((spend / conversions) * 100) / 100 : 0,
      },
      { onConflict: 'campaign_id,date' }
    )

    if (!error) synced++
  }

  return synced
}

// ─── Step 3: Run Metrics Engine over persisted insights ───
// Reads ad_insights_daily, runs the pipeline, persists:
//   campaign_scores, campaign_signals, recommendations
// Versioned by snapshot_date + is_current flag.

async function runMetricsEngine(userId: string): Promise<{ scores: number; signals: number; recs: number }> {
  const supabase = await createClient()
  const today = new Date().toISOString().split('T')[0]
  const timeWindow = 'last_7d'

  // Mark previous outputs as not current
  await supabase.from('campaign_scores').update({ is_current: false }).eq('user_id', userId).eq('is_current', true)
  await supabase.from('campaign_signals').update({ is_current: false }).eq('user_id', userId).eq('is_current', true)
  await supabase.from('recommendations').update({ is_current: false }).eq('user_id', userId).eq('is_current', true)

  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('id, name, status, objective, daily_budget')
    .eq('user_id', userId)
    .eq('is_active', true)

  if (!campaigns || campaigns.length === 0) return { scores: 0, signals: 0, recs: 0 }

  let scoresWritten = 0
  let signalsWritten = 0
  let recsWritten = 0

  for (const c of campaigns) {
    const { data: rows } = await supabase
      .from('ad_insights_daily')
      .select('spend, impressions, clicks, ctr, cpc, cpm, conversions, conversion_value, frequency, reach')
      .eq('campaign_id', c.id)
      .order('date', { ascending: false })
      .limit(7)

    if (!rows || rows.length === 0) continue

    // Pipeline
    const metrics = metricsFromDailyRows(rows as DailyInsightRow[])
    const classification = classifyCampaign(metrics)
    const score = calculateScore(metrics, classification)
    const signals = detectSignals({ metrics, classification, score })
    const rec = recommendationFromSignals(signals, classification, metrics, score)

    // Persist score snapshot
    const { error: scoreErr } = await supabase.from('campaign_scores').upsert(
      {
        user_id: userId,
        campaign_id: c.id,
        snapshot_date: today,
        time_window: timeWindow,
        score: score.score,
        confidence: score.confidence,
        classification,
        metrics_snapshot: metrics as unknown as Record<string, unknown>,
        is_current: true,
      },
      { onConflict: 'user_id,campaign_id,snapshot_date,time_window' }
    )
    if (!scoreErr) scoresWritten++

    // Persist signals (one row per signal type detected)
    for (const s of signals) {
      const { error: sigErr } = await supabase.from('campaign_signals').upsert(
        {
          user_id: userId,
          campaign_id: c.id,
          snapshot_date: today,
          time_window: timeWindow,
          signal_type: s.type,
          severity: s.severity,
          confidence: s.confidence,
          explanation: s.explanation,
          impact_value: s.impact_value,
          impact_type: s.impact_type,
          triggered_metrics: s.triggered_metrics as unknown as Record<string, unknown>,
          is_current: true,
        },
        { onConflict: 'user_id,campaign_id,snapshot_date,signal_type,time_window' }
      )
      if (!sigErr) signalsWritten++
    }

    // Persist recommendation
    const { error: recErr } = await supabase.from('recommendations').insert({
      user_id: userId,
      campaign_id: c.id,
      action: rec.action,
      label: actionLabel(rec.action),
      score: score.score,
      confidence: rec.confidence,
      impact_value: rec.expectedImpact.value,
      impact_type: rec.expectedImpact.type,
      reason: rec.reason,
      snapshot_date: today,
      is_current: true,
    })
    if (!recErr) recsWritten++
  }

  return { scores: scoresWritten, signals: signalsWritten, recs: recsWritten }
}

const actionLabels: Record<string, string> = {
  PAUSE: 'Pausar',
  SCALE: 'Escalar',
  REVIEW_CREATIVE: 'Revisar creativo',
  REVIEW_TARGETING: 'Revisar segmentación',
  FIX_LANDING: 'Revisar landing',
  REDUCE_BUDGET: 'Reducir presupuesto',
  MONITOR: 'Vigilar',
  WAIT: 'Esperar',
}
const actionLabel = (a: string) => actionLabels[a] ?? a

// ─── Public: Full Sync ───

export interface SyncResult {
  ok: boolean
  sync_id?: string
  campaigns_synced: number
  insights_synced: number
  scores_written?: number
  signals_written?: number
  recommendations_written?: number
  error?: string
}

export async function fullSync(userId: string, token: string, accountId: string): Promise<SyncResult> {
  const isRunning = await hasActiveSync(userId)
  if (isRunning) return { ok: false, campaigns_synced: 0, insights_synced: 0, error: 'Sync ya en progreso' }
  if (!acquireLock(userId)) return { ok: false, campaigns_synced: 0, insights_synced: 0, error: 'Sync bloqueada' }

  const supabase = await createClient()
  const { data: logEntry } = await supabase
    .from('sync_log')
    .insert({ user_id: userId, sync_type: 'full', status: 'started' })
    .select('id')
    .single()
  const syncId = logEntry?.id

  try {
    const campaignsSynced = await syncCampaigns(userId, token, accountId)
    const insightsSynced = await syncInsights(userId, token, accountId)
    const engine = await runMetricsEngine(userId)

    if (syncId) {
      await supabase
        .from('sync_log')
        .update({
          status: 'completed',
          campaigns_synced: campaignsSynced,
          insights_synced: insightsSynced,
          completed_at: new Date().toISOString(),
        })
        .eq('id', syncId)
    }

    releaseLock(userId)
    return {
      ok: true,
      sync_id: syncId,
      campaigns_synced: campaignsSynced,
      insights_synced: insightsSynced,
      scores_written: engine.scores,
      signals_written: engine.signals,
      recommendations_written: engine.recs,
    }
  } catch (err) {
    if (syncId) {
      await supabase
        .from('sync_log')
        .update({
          status: 'error',
          error_message: err instanceof Error ? err.message : 'Unknown error',
          completed_at: new Date().toISOString(),
        })
        .eq('id', syncId)
    }
    releaseLock(userId)
    return {
      ok: false,
      sync_id: syncId,
      campaigns_synced: 0,
      insights_synced: 0,
      error: err instanceof Error ? err.message : 'Sync failed',
    }
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
  const stale = !lastSync || Date.now() - new Date(lastSync).getTime() > 15 * 60 * 1000
  return { last_sync: lastSync, stale, syncing: (running?.length || 0) > 0 }
}

export async function checkSyncRateLimit(userId: string): Promise<{ allowed: boolean; waitSeconds?: number }> {
  return checkRateLimit(userId)
}
