// AdPilot — Analyst service.
// 1) Lee snapshot inicial de la cuenta desde Supabase.
// 2) Define las 5 tools envueltas en el formato del AI SDK.
// 3) Arma el streamText con rol ANALYST + retry automático con fallback model.

import { stepCountIs, streamText } from 'ai'
import { z } from 'zod'
import { createClient } from '@/lib/db/supabase/server'
import { getFallbackModel, getModel, getRoleConfig } from '@/lib/ai/model'

import { buildAnalystSystemPrompt } from '../prompts/system-prompt'
import { getCampaigns } from '../tools/get-campaigns'
import { getInsights } from '../tools/get-insights'
import { getRecommendations } from '../tools/get-recommendations'
import { getSignals } from '../tools/get-signals'
import { simulateScaling } from '../tools/simulate-scaling'
import type { AccountSnapshot, AnalystEmpty, ChatMessage } from '../types'

// ─── Empty-state precheck ───
// Llamar antes de invocar el LLM. Devuelve null si todo OK.

export async function precheckAnalyst(userId: string): Promise<AnalystEmpty | null> {
  const supabase = await createClient()

  const { data: meta } = await supabase
    .from('meta_connections')
    .select('id')
    .eq('user_id', userId)
    .order('connected_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!meta) {
    return {
      state: 'empty',
      reason: 'no_meta',
      message: 'Conecta y sincroniza tu cuenta de Meta para empezar a analizar.',
      cta: { label: 'Conectar Meta', action: 'connect_meta' },
    }
  }

  const { data: lastSync } = await supabase
    .from('sync_log')
    .select('completed_at')
    .eq('user_id', userId)
    .eq('status', 'completed')
    .order('completed_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!lastSync) {
    return {
      state: 'empty',
      reason: 'no_sync',
      message: 'Aún no hay datos sincronizados para analizar. Sincroniza para empezar.',
      cta: { label: 'Sincronizar ahora', action: 'sync' },
    }
  }
  return null
}

// ─── Snapshot del estado de la cuenta (se inyecta al system prompt) ───

async function loadSnapshot(userId: string): Promise<AccountSnapshot> {
  const supabase = await createClient()

  const [campaignsRes, scoresRes, recsRes, syncRes] = await Promise.all([
    supabase.from('campaigns').select('id').eq('user_id', userId).eq('is_active', true),
    supabase.from('campaign_scores').select('classification').eq('user_id', userId).eq('is_current', true),
    supabase.from('recommendations').select('action, impact_value, impact_type, reviewed_at').eq('user_id', userId).eq('is_current', true),
    supabase.from('sync_log').select('completed_at').eq('user_id', userId).eq('status', 'completed').order('completed_at', { ascending: false }).limit(1).maybeSingle(),
  ])

  const scores = scoresRes.data ?? []
  const recs = recsRes.data ?? []
  const unreviewed = recs.filter(r => !r.reviewed_at && r.action !== 'WAIT' && r.action !== 'MONITOR')

  const r2 = (n: number) => Math.round(n * 100) / 100

  return {
    total_active_campaigns: campaignsRes.data?.length ?? 0,
    winners: scores.filter(s => s.classification === 'winner' || s.classification === 'healthy').length,
    at_risk: scores.filter(s => s.classification === 'at_risk').length,
    losers: scores.filter(s => s.classification === 'loser').length,
    pending_actions: unreviewed.length,
    avoidable_loss_per_day: r2(unreviewed.filter(r => r.impact_type === 'loss_prevention').reduce((s, r) => s + Number(r.impact_value || 0), 0)),
    revenue_opportunity_per_day: r2(unreviewed.filter(r => r.impact_type === 'opportunity').reduce((s, r) => s + Number(r.impact_value || 0), 0)),
    last_sync: (syncRes.data?.completed_at as string) ?? null,
  }
}

// ─── Tools wrapped for AI SDK ───

function buildTools(userId: string) {
  return {
    getCampaigns: {
      description: 'Lista campañas activas con score, clasificación y daily_budget. Úsala cuando te pregunten "cuáles", "lista", "muéstrame".',
      parameters: z.object({
        limit: z.number().int().positive().max(50).default(20),
      }),
      execute: async ({ limit }: { limit: number }) => getCampaigns(userId, { limit }),
    },
    getRecommendations: {
      description: 'Recomendaciones activas (qué hacer, sobre qué campaña, con cuánto impacto). Úsala para "qué debería hacer", "qué pausar", "qué escalar".',
      parameters: z.object({
        onlyAction: z.enum(['PAUSE', 'SCALE', 'REVIEW_CREATIVE', 'REVIEW_TARGETING', 'FIX_LANDING', 'REDUCE_BUDGET', 'MONITOR', 'WAIT']).optional(),
        limit: z.number().int().positive().max(30).default(10),
      }),
      execute: async ({ onlyAction, limit }: { onlyAction?: string; limit: number }) =>
        getRecommendations(userId, { onlyAction, limit }),
    },
    getSignals: {
      description: 'Señales determinísticas detectadas (zombie_campaign, creative_fatigue, high_cpa, low_ctr, ready_to_scale, landing_problem, audience_saturation, overspend, underspend, learning_limited). Úsala para "por qué", "qué problema tiene", "qué se está fatigando".',
      parameters: z.object({
        onlyType: z.enum([
          'creative_fatigue', 'zombie_campaign', 'high_cpa', 'low_ctr',
          'ready_to_scale', 'landing_problem', 'audience_saturation',
          'overspend', 'underspend', 'learning_limited',
        ]).optional(),
        limit: z.number().int().positive().max(50).default(20),
      }),
      execute: async ({ onlyType, limit }: { onlyType?: string; limit: number }) =>
        getSignals(userId, { onlyType, limit }),
    },
    getInsights: {
      description: 'Métricas con ventanas temporales (1d/3d/7d/14d) + nota de tendencia. Úsala para "qué pasó esta semana", "subió el CPA", "cómo viene la tendencia". Si no se especifica campaignId, devuelve agregado de la cuenta.',
      parameters: z.object({
        campaignId: z.string().optional(),
      }),
      execute: async ({ campaignId }: { campaignId?: string }) => getInsights(userId, { campaignId }),
    },
    simulateScaling: {
      description: 'Simulación determinística (NO usa LLM): "qué pasaría si subes presupuesto 20%", "si pausas X", "si bajas budget 50%". Úsala para "qué pasa si", simulaciones, proyecciones.',
      parameters: z.object({
        campaignId: z.string().optional(),
        campaignName: z.string().optional(),
        action: z.enum(['SCALE_UP', 'PAUSE', 'REDUCE_BUDGET']),
        pct: z.number().optional().describe('Porcentaje. Default: 20 para SCALE_UP, -50 para REDUCE_BUDGET, ignorado en PAUSE.'),
      }),
      execute: async ({ campaignId, campaignName, action, pct }: { campaignId?: string; campaignName?: string; action: 'SCALE_UP' | 'PAUSE' | 'REDUCE_BUDGET'; pct?: number }) =>
        simulateScaling(userId, { campaignId, campaignName, action, pct }),
    },
  }
}

// ─── Streaming entry point ───

export async function streamAnalystResponse(userId: string, messages: ChatMessage[]) {
  const snapshot = await loadSnapshot(userId)
  const system = buildAnalystSystemPrompt(snapshot)
  const tools = buildTools(userId)

  const cleanedMessages = messages.map(m => ({ role: m.role, content: m.content }))
  const cfg = getRoleConfig('ANALYST')

  const baseOptions = {
    system,
    messages: cleanedMessages,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tools: tools as any,
    stopWhen: stepCountIs(3),
    maxOutputTokens: cfg.maxOutputTokens,
    timeout: 45000,
  }

  try {
    const result = streamText({ model: getModel('ANALYST'), ...baseOptions })
    return result.toUIMessageStreamResponse()
  } catch {
    const result = streamText({ model: getFallbackModel('ANALYST'), ...baseOptions })
    return result.toUIMessageStreamResponse()
  }
}
