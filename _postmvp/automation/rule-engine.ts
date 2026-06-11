// ─────────────────────────────────────────────────────────────
// AdPilot — Rule Engine (FASE 3)
// Evaluates automation rules against campaign metrics
// Creates actions in queue with idempotency protection
// ─────────────────────────────────────────────────────────────

import { createClient } from '@/lib/supabase/server'
import crypto from 'crypto'

interface CampaignMetrics {
  id: string
  name: string
  score: number
  ctr: number
  cpc: number
  spend: number
  conversions: number
  frequency: number
  roas: number
  classification: string
  impact_value: number
}

interface Rule {
  id: string
  name: string
  priority: number
  trigger_type: string
  trigger_operator: string
  trigger_value: number
  action_type: string
  action_params: Record<string, unknown>
  requires_approval: boolean
}

// ─── Idempotency Hash ───

function makeHash(userId: string, campaignId: string, actionType: string, date: string): string {
  const raw = `${userId}:${campaignId}:${actionType}:${date}`
  return crypto.createHash('sha256').update(raw).digest('hex').slice(0, 40)
}

// ─── Rule Evaluation ───

function evaluateRule(rule: Rule, metrics: CampaignMetrics): boolean {
  let value: number

  switch (rule.trigger_type) {
    case 'zombie':
      // Special: spend > threshold AND conversions = 0
      return metrics.spend > rule.trigger_value && metrics.conversions === 0
    case 'fatigue':
      // Special: frequency > threshold AND ctr < 0.8
      return metrics.frequency > rule.trigger_value && metrics.ctr < 0.8
    case 'score_above':
      value = metrics.score; break
    case 'score_below':
      value = metrics.score; break
    case 'ctr_above':
      value = metrics.ctr; break
    case 'ctr_below':
      value = metrics.ctr; break
    case 'spend_above':
      value = metrics.spend; break
    case 'cpc_above':
      value = metrics.cpc; break
    case 'roas_above':
      value = metrics.roas; break
    case 'frequency_above':
      value = metrics.frequency; break
    default:
      return false
  }

  switch (rule.trigger_operator) {
    case '<': return value < rule.trigger_value
    case '>': return value > rule.trigger_value
    case '<=': return value <= rule.trigger_value
    case '>=': return value >= rule.trigger_value
    case '=': return value === rule.trigger_value
    default: return false
  }
}

function generateReason(rule: Rule, metrics: CampaignMetrics): string {
  switch (rule.trigger_type) {
    case 'zombie': return `Campaña zombie: $${metrics.spend.toFixed(2)} gastados, ${metrics.conversions} conversiones`
    case 'fatigue': return `Fatiga creativa: frecuencia ${metrics.frequency.toFixed(1)}, CTR ${metrics.ctr.toFixed(2)}%`
    case 'score_above': return `Score ${metrics.score}/100. Candidata para escalar.`
    case 'ctr_below': return `CTR ${metrics.ctr.toFixed(2)}% por debajo del mínimo.`
    case 'ctr_above': return `CTR ${metrics.ctr.toFixed(1)}% con buen rendimiento. Oportunidad de escala.`
    default: return `Regla "${rule.name}" activada: ${rule.trigger_type} ${rule.trigger_operator} ${rule.trigger_value}`
  }
}

function estimateImpact(rule: Rule, metrics: CampaignMetrics): { value: number; type: string } {
  if (rule.action_type === 'PAUSE') {
    return { value: Math.round((metrics.spend / 7) * 100) / 100, type: 'loss_prevention' }
  }
  if (rule.action_type === 'SCALE') {
    const pct = (rule.action_params?.scale_percent as number) || 20
    return { value: Math.round(((metrics.spend / 7) * (pct / 100)) * 100) / 100, type: 'opportunity' }
  }
  return { value: 0, type: 'opportunity' }
}

// ─── Main: Evaluate Rules ───

export async function evaluateRules(userId: string): Promise<{ actionsCreated: number; expired: number }> {
  const supabase = await createClient()
  const today = new Date().toISOString().split('T')[0]

  // 1. Read settings
  const { data: settings } = await supabase
    .from('automation_settings')
    .select('*')
    .eq('user_id', userId)
    .single()

  if (!settings || !settings.automation_enabled) return { actionsCreated: 0, expired: 0 }

  // 2. Expire old pending actions (>24h)
  const { data: expiredActions } = await supabase
    .from('action_queue')
    .select('id')
    .eq('user_id', userId)
    .eq('status', 'pending')
    .lt('expires_at', new Date().toISOString())

  let expiredCount = 0
  if (expiredActions) {
    for (const a of expiredActions) {
      await supabase.from('action_queue').update({ status: 'expired' }).eq('id', a.id)
      expiredCount++
    }
  }

  // 3. Read active rules ordered by priority
  const { data: rules } = await supabase
    .from('automation_rules')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('priority', { ascending: true })

  if (!rules || rules.length === 0) return { actionsCreated: 0, expired: expiredCount }

  // 4. Read campaign metrics from recommendations
  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('id, name')
    .eq('user_id', userId)
    .eq('is_active', true)

  if (!campaigns) return { actionsCreated: 0, expired: expiredCount }

  // Build metrics per campaign
  const campaignMetrics: CampaignMetrics[] = []
  for (const c of campaigns) {
    const { data: insights } = await supabase
      .from('ad_insights_daily')
      .select('spend, clicks, impressions, ctr, cpc, conversions, conversion_value, frequency')
      .eq('campaign_id', c.id)
      .order('date', { ascending: false })
      .limit(7)

    if (!insights || insights.length === 0) continue

    const totalSpend = insights.reduce((s, i) => s + Number(i.spend), 0)
    const totalClicks = insights.reduce((s, i) => s + Number(i.clicks), 0)
    const totalImpressions = insights.reduce((s, i) => s + Number(i.impressions), 0)
    const totalConversions = insights.reduce((s, i) => s + Number(i.conversions), 0)
    const totalConvValue = insights.reduce((s, i) => s + Number(i.conversion_value), 0)
    const avgCtr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0
    const avgCpc = totalClicks > 0 ? totalSpend / totalClicks : 0
    const avgFreq = insights.reduce((s, i) => s + Number(i.frequency), 0) / insights.length
    const roas = totalSpend > 0 ? totalConvValue / totalSpend : 0

    // Simple score calc
    const s1 = Math.min(30, (avgCtr / 3) * 30)
    const s2 = avgCpc <= 0.05 ? 18 : avgCpc <= 0.50 ? 15 : avgCpc <= 1.50 ? 10 : 5
    const score = Math.min(100, Math.round(s1 + s2 + (totalConversions > 0 ? 20 : 0) + (avgFreq < 2 ? 15 : 5)))

    campaignMetrics.push({
      id: c.id, name: c.name, score, ctr: avgCtr, cpc: avgCpc,
      spend: totalSpend, conversions: totalConversions, frequency: avgFreq,
      roas, classification: score >= 70 ? 'winner' : score >= 45 ? 'at_risk' : 'loser',
      impact_value: 0,
    })
  }

  // 5. Calculate today's budget spent on actions
  const { data: todayActions } = await supabase
    .from('action_log')
    .select('impact_value')
    .eq('user_id', userId)
    .gte('executed_at', `${today}T00:00:00Z`)

  const budgetUsed = (todayActions || []).reduce((s, a) => s + Number(a.impact_value || 0), 0)
  const budgetRemaining = Number(settings.budget_limit_daily) - budgetUsed

  // 6. Evaluate rules against each campaign
  let actionsCreated = 0

  for (const metrics of campaignMetrics) {
    for (const rule of rules as Rule[]) {
      if (!evaluateRule(rule, metrics)) continue

      // Check idempotency — already have this action today?
      const hash = makeHash(userId, metrics.id, rule.action_type, today)
      const { data: existing } = await supabase
        .from('action_queue')
        .select('id')
        .eq('idempotency_hash', hash)
        .limit(1)

      if (existing && existing.length > 0) continue // Already created today

      // Check active action for this campaign (1 per campaign)
      const { data: activeAction } = await supabase
        .from('action_queue')
        .select('id, action_type')
        .eq('campaign_id', metrics.id)
        .eq('user_id', userId)
        .in('status', ['pending', 'approved'])
        .limit(1)

      if (activeAction && activeAction.length > 0) {
        // PAUSE overrides SCALE
        if (rule.action_type === 'PAUSE' && activeAction[0].action_type === 'SCALE') {
          await supabase.from('action_queue').update({ status: 'expired' }).eq('id', activeAction[0].id)
        } else {
          continue // Already has active action
        }
      }

      // Check cool-down
      const { data: recentAction } = await supabase
        .from('action_log')
        .select('executed_at')
        .eq('campaign_id', metrics.id)
        .eq('user_id', userId)
        .order('executed_at', { ascending: false })
        .limit(1)
        .single()

      if (recentAction) {
        const elapsed = Date.now() - new Date(recentAction.executed_at).getTime()
        if (elapsed < settings.cool_down_minutes * 60 * 1000) continue
      }

      // Check budget limit (for SCALE actions)
      const impact = estimateImpact(rule, metrics)
      if (rule.action_type === 'SCALE' && budgetRemaining <= 0) continue

      // Determine approval
      let needsApproval = rule.requires_approval || settings.approval_required
      let autoApprove = false

      if (rule.action_type === 'PAUSE' && settings.auto_pause_enabled && !settings.approval_required) {
        needsApproval = false
        autoApprove = true
      }
      if (rule.action_type === 'SCALE' && settings.auto_scale_enabled && !settings.approval_required) {
        needsApproval = false
        autoApprove = true
      }
      if (rule.action_type === 'NOTIFY') {
        needsApproval = false
        autoApprove = true
      }

      // Create action
      await supabase.from('action_queue').insert({
        user_id: userId,
        rule_id: rule.id,
        campaign_id: metrics.id,
        campaign_name: metrics.name,
        action_type: rule.action_type,
        action_params: rule.action_params,
        status: autoApprove ? 'approved' : 'pending',
        priority: rule.priority,
        impact_value: impact.value,
        impact_type: impact.type,
        reason: generateReason(rule, metrics),
        requires_approval: needsApproval,
        approved_at: autoApprove ? new Date().toISOString() : null,
        approved_by: autoApprove ? 'auto' : null,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        idempotency_hash: hash,
      })

      actionsCreated++
    }
  }

  return { actionsCreated, expired: expiredCount }
}
