// AdPilot — Analyst tool: getSignals.
// Lee las señales activas (campaign_signals con is_current = true).

import { createClient } from '@/lib/db/supabase/server'

export interface SignalSummary {
  campaign_id: string
  campaign_name: string
  signal_type: string
  severity: string
  confidence: string
  explanation: string
  impact_value: number
  impact_type: string
}

const SEV_RANK: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 }

export async function getSignals(
  userId: string,
  opts?: { onlyType?: string; limit?: number }
): Promise<SignalSummary[]> {
  const supabase = await createClient()
  const limit = opts?.limit ?? 30

  let query = supabase
    .from('campaign_signals')
    .select('campaign_id, signal_type, severity, confidence, explanation, impact_value, impact_type')
    .eq('user_id', userId)
    .eq('is_current', true)
    .limit(limit)

  if (opts?.onlyType) query = query.eq('signal_type', opts.onlyType)

  const [signalsRes, campaignsRes] = await Promise.all([
    query,
    supabase.from('campaigns').select('id, name').eq('user_id', userId),
  ])

  const signals = signalsRes.data ?? []
  const nameById = new Map((campaignsRes.data ?? []).map(c => [c.id, c.name as string]))

  const out: SignalSummary[] = signals.map(s => ({
    campaign_id: s.campaign_id as string,
    campaign_name: nameById.get(s.campaign_id as string) ?? 'Campaña',
    signal_type: s.signal_type as string,
    severity: s.severity as string,
    confidence: s.confidence as string,
    explanation: (s.explanation as string) ?? '',
    impact_value: Number(s.impact_value) || 0,
    impact_type: (s.impact_type as string) ?? 'opportunity',
  }))

  out.sort((a, b) => (SEV_RANK[a.severity] ?? 9) - (SEV_RANK[b.severity] ?? 9))
  return out
}
