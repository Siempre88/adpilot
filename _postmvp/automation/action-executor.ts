// ─────────────────────────────────────────────────────────────
// AdPilot — Action Executor (FASE 3)
// Executes approved actions from the queue
// FASE 3 = dry_run only. No writes to Meta API.
// Enriched audit trail with before/after/rule context.
// ─────────────────────────────────────────────────────────────

import { createClient } from '@/lib/supabase/server'

const EXECUTION_TIMEOUT = 10_000 // 10 seconds max per action

interface ActionQueueItem {
  id: string
  user_id: string
  rule_id: string | null
  campaign_id: string
  campaign_name: string
  action_type: string
  action_params: Record<string, unknown>
  status: string
  priority: number
  impact_value: number
  impact_type: string | null
  reason: string
  approved_by: string | null
}

// ─── Generate dry_run instruction ───

function generateInstruction(action: ActionQueueItem): string {
  switch (action.action_type) {
    case 'PAUSE':
      return `Pausa la campaña "${action.campaign_name}" en Meta Ads Manager. ID: ${action.campaign_id}`
    case 'SCALE': {
      const pct = (action.action_params?.scale_percent as number) || 20
      return `Sube el presupuesto de "${action.campaign_name}" un ${pct}% en Meta Ads Manager. ID: ${action.campaign_id}`
    }
    case 'REVIEW_CREATIVE':
      return `Cambia el creativo de "${action.campaign_name}". El actual no genera clicks suficientes.`
    case 'REVIEW_TARGETING':
      return `Revisa la segmentación de "${action.campaign_name}". Amplía o cambia la audiencia.`
    case 'NOTIFY':
      return `Alerta: ${action.reason}`
    default:
      return `Acción ${action.action_type} para "${action.campaign_name}"`
  }
}

// ─── Execute single action ───

async function executeAction(action: ActionQueueItem): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()

  // Double-check status (protection against race conditions)
  const { data: current } = await supabase
    .from('action_queue')
    .select('status')
    .eq('id', action.id)
    .single()

  if (!current || current.status !== 'approved') {
    return { success: false, error: `Action status is "${current?.status}", expected "approved"` }
  }

  // Get campaign metrics for before-state
  const { data: insights } = await supabase
    .from('ad_insights_daily')
    .select('spend, ctr, cpc, clicks, conversions, frequency')
    .eq('campaign_id', action.campaign_id)
    .order('date', { ascending: false })
    .limit(1)
    .single()

  // Get rule name if available
  let ruleName = 'Manual'
  if (action.rule_id) {
    const { data: rule } = await supabase
      .from('automation_rules')
      .select('name')
      .eq('id', action.rule_id)
      .single()
    if (rule) ruleName = rule.name
  }

  const beforeState = insights ? {
    spend: Number(insights.spend),
    ctr: Number(insights.ctr),
    cpc: Number(insights.cpc),
    clicks: Number(insights.clicks),
    conversions: Number(insights.conversions),
    frequency: Number(insights.frequency),
  } : {}

  // FASE 3: dry_run — no actual Meta API call
  const instruction = generateInstruction(action)

  // Enriched audit result
  const result = {
    mode: 'dry_run',
    instruction,
    before: beforeState,
    after: { note: 'Dry run — no changes applied to Meta Ads' },
    reason: action.reason,
    rule: ruleName,
    campaign_id: action.campaign_id,
    approved_by: action.approved_by || 'unknown',
    timestamp: new Date().toISOString(),
  }

  // Write to action_log (immutable)
  await supabase.from('action_log').insert({
    user_id: action.user_id,
    action_queue_id: action.id,
    campaign_id: action.campaign_id,
    campaign_name: action.campaign_name,
    action_type: action.action_type,
    action_params: action.action_params,
    status: 'dry_run',
    result,
    impact_value: action.impact_value,
    executed_at: new Date().toISOString(),
    execution_mode: action.approved_by === 'auto' ? 'auto' : 'approved',
  })

  // Update queue status
  await supabase.from('action_queue').update({ status: 'executed' }).eq('id', action.id)

  return { success: true }
}

// ─── Process all approved actions for a user ───

export async function processApprovedActions(userId: string): Promise<{ executed: number; failed: number }> {
  const supabase = await createClient()

  const { data: approved } = await supabase
    .from('action_queue')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'approved')
    .order('priority', { ascending: true })
    .order('impact_value', { ascending: false })

  if (!approved || approved.length === 0) return { executed: 0, failed: 0 }

  let executed = 0
  let failed = 0

  for (const action of approved as ActionQueueItem[]) {
    try {
      // Timeout protection
      const result = await Promise.race([
        executeAction(action),
        new Promise<{ success: false; error: string }>((resolve) =>
          setTimeout(() => resolve({ success: false, error: 'Execution timeout' }), EXECUTION_TIMEOUT)
        ),
      ])

      if (result.success) executed++
      else {
        failed++
        await supabase.from('action_queue').update({ status: 'failed' }).eq('id', action.id)
        await supabase.from('action_log').insert({
          user_id: userId,
          action_queue_id: action.id,
          campaign_id: action.campaign_id,
          campaign_name: action.campaign_name,
          action_type: action.action_type,
          action_params: action.action_params,
          status: 'failed',
          result: { error: result.error },
          error_message: result.error,
          executed_at: new Date().toISOString(),
          execution_mode: action.approved_by === 'auto' ? 'auto' : 'approved',
        })
      }
    } catch (err) {
      failed++
      await supabase.from('action_queue').update({ status: 'failed' }).eq('id', action.id)
    }
  }

  return { executed, failed }
}

// ─── Approve a single action ───

export async function approveAction(userId: string, actionId: string): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient()

  const { data: action } = await supabase
    .from('action_queue')
    .select('*')
    .eq('id', actionId)
    .eq('user_id', userId)
    .eq('status', 'pending')
    .single()

  if (!action) return { ok: false, error: 'Acción no encontrada o ya procesada' }

  await supabase.from('action_queue').update({
    status: 'approved',
    approved_at: new Date().toISOString(),
    approved_by: 'user',
  }).eq('id', actionId)

  // Execute immediately
  const result = await executeAction(action as ActionQueueItem)
  return { ok: result.success, error: result.error }
}

// ─── Reject a single action ───

export async function rejectAction(userId: string, actionId: string, reason?: string): Promise<{ ok: boolean }> {
  const supabase = await createClient()

  await supabase.from('action_queue').update({
    status: 'rejected',
    rejected_at: new Date().toISOString(),
    rejected_reason: reason || 'Rechazada por el usuario',
  }).eq('id', actionId).eq('user_id', userId)

  return { ok: true }
}
