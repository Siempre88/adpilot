// AdPilot — Analyst tool: getRecommendations.
// Lee recomendaciones activas (is_current = true). NO inventa; solo cita el rules engine.

import { createClient } from '@/lib/db/supabase/server'

export interface RecommendationSummary {
  campaign_id: string
  campaign_name: string
  action: string
  reason: string
  impact_value: number
  impact_type: string
  confidence: string
  reviewed: boolean
}

export async function getRecommendations(
  userId: string,
  opts?: { onlyAction?: string; limit?: number }
): Promise<RecommendationSummary[]> {
  const supabase = await createClient()
  const limit = opts?.limit ?? 20

  let query = supabase
    .from('recommendations')
    .select('campaign_id, action, reason, impact_value, impact_type, confidence, reviewed_at')
    .eq('user_id', userId)
    .eq('is_current', true)
    .order('impact_value', { ascending: false })
    .limit(limit)

  if (opts?.onlyAction) query = query.eq('action', opts.onlyAction)

  const [recsRes, campaignsRes] = await Promise.all([
    query,
    supabase.from('campaigns').select('id, name').eq('user_id', userId),
  ])

  const recs = recsRes.data ?? []
  const nameById = new Map((campaignsRes.data ?? []).map(c => [c.id, c.name as string]))

  return recs.map(r => ({
    campaign_id: r.campaign_id as string,
    campaign_name: nameById.get(r.campaign_id as string) ?? 'Campaña',
    action: r.action as string,
    reason: (r.reason as string) ?? '',
    impact_value: Number(r.impact_value) || 0,
    impact_type: (r.impact_type as string) ?? 'opportunity',
    confidence: (r.confidence as string) ?? 'low',
    reviewed: !!r.reviewed_at,
  }))
}
