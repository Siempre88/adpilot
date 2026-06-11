// AdPilot — Analyst tool: getCampaigns.
// Lee campañas activas + score actual + clasificación desde Supabase.
// NO llama Meta. Devuelve JSON ligero para que el LLM lo cite.

import { createClient } from '@/lib/db/supabase/server'

export interface CampaignSummary {
  id: string
  name: string
  classification: string
  score: number
  confidence: string
  daily_budget: number
}

export async function getCampaigns(userId: string, opts?: { limit?: number }): Promise<CampaignSummary[]> {
  const supabase = await createClient()
  const limit = opts?.limit ?? 50

  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('id, name, daily_budget')
    .eq('user_id', userId)
    .eq('is_active', true)
    .limit(limit)

  if (!campaigns || campaigns.length === 0) return []

  const ids = campaigns.map(c => c.id)
  const { data: scores } = await supabase
    .from('campaign_scores')
    .select('campaign_id, score, confidence, classification')
    .eq('user_id', userId)
    .eq('is_current', true)
    .in('campaign_id', ids)

  const scoreById = new Map((scores ?? []).map(s => [s.campaign_id, s]))

  return campaigns.map(c => {
    const s = scoreById.get(c.id)
    return {
      id: c.id,
      name: c.name,
      classification: (s?.classification as string) ?? 'no_data',
      score: Number(s?.score ?? 0),
      confidence: (s?.confidence as string) ?? 'low',
      daily_budget: Number(c.daily_budget) || 0,
    }
  })
}
