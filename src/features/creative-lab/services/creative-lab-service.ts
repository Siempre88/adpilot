// AdPilot — Creative Lab service.
// Server-only. Lee Supabase, arma diagnóstico, llama LLM con prompts internos.

import { generateText, streamText } from 'ai'
import { createClient } from '@/lib/db/supabase/server'
import { getFallbackModel, getModel, getRoleConfig } from '@/lib/ai/model'
import type {
  CampaignClassification,
  RecommendationAction,
  RecommendationConfidence,
  SignalSeverity,
  SignalType,
} from '@/shared/types/database'

import { buildCopyPrompt } from '../prompts/copy-prompt'
import { buildCriticSystemPrompt, buildCriticUserMessage } from '../prompts/critic-prompt'
import { buildHookPrompt } from '../prompts/hook-prompt'
import { buildUgcScriptPrompt } from '../prompts/ugc-script-prompt'
import type {
  CampaignChoice,
  CopyVariant,
  CreativeAngle,
  CreativeDiagnosis,
  CreativeLabBootstrap,
  CreativeLabEmpty,
  CreativeLabResponse,
  CtaVariant,
  GeneratedCreatives,
  HeadlineVariant,
  HookVariant,
  UgcScript,
} from '../types'

const SEV_RANK: Record<SignalSeverity, number> = { critical: 0, high: 1, medium: 2, low: 3 }

const SIGNAL_LABEL: Record<SignalType, string> = {
  zombie_campaign: 'Campaña zombie',
  creative_fatigue: 'Fatiga creativa',
  high_cpa: 'CPA alto',
  low_ctr: 'CTR bajo',
  ready_to_scale: 'Lista para escalar',
  landing_problem: 'Problema en landing',
  audience_saturation: 'Audiencia saturada',
  overspend: 'Gasto desproporcionado',
  underspend: 'Gasto bajo',
  learning_limited: 'Aprendizaje limitado',
}

// ─── 1) Bootstrap: lista priorizada de campañas creativamente accionables ───

export async function getCreativeLabBootstrap(userId: string): Promise<CreativeLabResponse> {
  const supabase = await createClient()

  // Empty: no Meta connection
  const { data: meta } = await supabase
    .from('meta_connections')
    .select('id')
    .eq('user_id', userId)
    .order('connected_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!meta) {
    return empty('no_meta', 'Sincroniza tu cuenta Meta para generar creativos basados en datos reales.')
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
    return empty('no_sync', 'Sincroniza tu cuenta Meta para generar creativos basados en datos reales.')
  }

  // Load campaigns + scores + signals + recs in parallel
  const [campsRes, scoresRes, signalsRes, recsRes] = await Promise.all([
    supabase.from('campaigns').select('id, name, objective').eq('user_id', userId).eq('is_active', true),
    supabase.from('campaign_scores').select('campaign_id, score, classification, confidence').eq('user_id', userId).eq('is_current', true),
    supabase.from('campaign_signals').select('campaign_id, signal_type, severity, confidence, explanation, impact_value').eq('user_id', userId).eq('is_current', true),
    supabase.from('recommendations').select('campaign_id, action, reason').eq('user_id', userId).eq('is_current', true),
  ])

  const campaigns = campsRes.data ?? []
  if (campaigns.length === 0) {
    return empty('no_sync', 'Aún no hay campañas activas. Sincroniza para empezar.')
  }

  const scoreById = new Map((scoresRes.data ?? []).map(s => [s.campaign_id, s]))
  const signalsByCampaign = groupBy(signalsRes.data ?? [], s => s.campaign_id)
  const recsByCampaign = new Map((recsRes.data ?? []).map(r => [r.campaign_id, r]))

  // Aggregate insight totals (last 7d) for context cards
  const ids = campaigns.map(c => c.id)
  const totalsById = await loadTotals(supabase, ids)

  // Build choices with priority
  const choices: CampaignChoice[] = []
  for (const c of campaigns) {
    const score = scoreById.get(c.id)
    const sigs = signalsByCampaign.get(c.id) ?? []
    const rec = recsByCampaign.get(c.id) ?? null
    const totals = totalsById.get(c.id) ?? { spend: 0, ctr: 0, cpa: 0, roas: 0 }

    // Pick most severe creative-relevant signal
    const creativeSignals = sigs.filter(s =>
      ['creative_fatigue', 'low_ctr', 'high_cpa', 'landing_problem', 'audience_saturation'].includes(s.signal_type as string)
    )
    creativeSignals.sort((a, b) => SEV_RANK[a.severity as SignalSeverity] - SEV_RANK[b.severity as SignalSeverity])
    const primary = creativeSignals[0] ?? sigs[0] ?? null

    const classification = (score?.classification as CampaignClassification) ?? 'no_data'
    const action = (rec?.action as RecommendationAction) ?? null

    const priority = computePriority({
      action,
      primarySignalType: (primary?.signal_type as SignalType) ?? null,
      classification,
      ctr: totals.ctr,
    })

    if (priority === 99) continue  // no creative angle for this campaign

    choices.push({
      id: c.id,
      name: c.name,
      classification,
      score: Number(score?.score ?? 0),
      priority,
      problem_label: primary
        ? SIGNAL_LABEL[primary.signal_type as SignalType] ?? primary.signal_type as string
        : (action === 'REVIEW_CREATIVE' ? 'Cambiar creativo' : 'Sin diagnóstico claro'),
      recommendation_action: action,
      primary_signal_type: (primary?.signal_type as SignalType) ?? null,
      primary_signal_severity: (primary?.severity as SignalSeverity) ?? null,
      spend: totals.spend,
      ctr: totals.ctr,
      cpa: totals.cpa,
      roas: totals.roas,
    })
  }

  // Sort by priority asc, then by spend desc as tiebreaker
  choices.sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority
    return b.spend - a.spend
  })

  if (choices.length === 0) {
    return empty('all_stable', 'Tus creativos se ven estables. Puedes generar nuevas variantes para test A/B desde Recomendaciones.')
  }

  const data: CreativeLabBootstrap = { state: 'loaded', campaigns: choices }
  return data
}

// ─── 2) Diagnosis builder ───

export async function buildDiagnosis(userId: string, campaignId: string): Promise<CreativeDiagnosis | null> {
  const supabase = await createClient()

  const [campRes, scoreRes, signalsRes, recRes] = await Promise.all([
    supabase.from('campaigns').select('id, name, objective').eq('user_id', userId).eq('id', campaignId).maybeSingle(),
    supabase.from('campaign_scores').select('classification, confidence').eq('user_id', userId).eq('campaign_id', campaignId).eq('is_current', true).maybeSingle(),
    supabase.from('campaign_signals').select('signal_type, severity, confidence, explanation').eq('user_id', userId).eq('campaign_id', campaignId).eq('is_current', true),
    supabase.from('recommendations').select('action, reason').eq('user_id', userId).eq('campaign_id', campaignId).eq('is_current', true).maybeSingle(),
  ])

  if (!campRes.data) return null
  const camp = campRes.data
  const sigs = (signalsRes.data ?? []).slice().sort((a, b) => SEV_RANK[a.severity as SignalSeverity] - SEV_RANK[b.severity as SignalSeverity])
  const primary = sigs[0] ?? null
  const score = scoreRes.data
  const rec = recRes.data

  // Aggregate metrics for affected_metric description
  const totals = (await loadTotals(supabase, [campaignId])).get(campaignId) ?? { spend: 0, ctr: 0, cpa: 0, roas: 0 }

  const { problem, affected_metric, probable_cause, creative_goal } = diagnose(
    primary?.signal_type as SignalType | undefined,
    rec?.action as RecommendationAction | undefined,
    totals
  )

  return {
    campaign_id: campaignId,
    campaign_name: camp.name as string,
    problem,
    affected_metric,
    probable_cause,
    creative_goal,
    severity: (primary?.severity as SignalSeverity) ?? 'medium',
    confidence: (score?.confidence as RecommendationConfidence) ?? (primary?.confidence as RecommendationConfidence) ?? 'low',
    recommendation_action: (rec?.action as RecommendationAction) ?? null,
  }
}

// ─── 3) Generate (parallel calls) ───

export async function generateCreatives(
  userId: string,
  campaignId: string,
  angle: CreativeAngle = 'auto'
): Promise<GeneratedCreatives | { error: string }> {
  const diagnosis = await buildDiagnosis(userId, campaignId)
  if (!diagnosis) return { error: 'Campaña no encontrada' }

  const supabase = await createClient()
  const { data: camp } = await supabase
    .from('campaigns')
    .select('objective')
    .eq('user_id', userId)
    .eq('id', campaignId)
    .maybeSingle()

  const objective = camp?.objective as string | undefined

  const hookP   = buildHookPrompt({ diagnosis, angle, campaign_objective: objective })
  const copyP   = buildCopyPrompt({ diagnosis, angle, campaign_objective: objective })
  const ugcP    = buildUgcScriptPrompt({ diagnosis, angle, campaign_objective: objective })

  const [hookRaw, copyRaw, ugcRaw] = await Promise.all([
    callJson(hookP),
    callJson(copyP),
    callJson(ugcP),
  ])

  const hooks      = parseHooks(hookRaw, angle)
  const copies     = parseCopies(copyRaw, angle)
  const headlines  = parseHeadlines(copyRaw, angle)
  const ctas       = parseCtas(copyRaw, angle)
  const ugc_scripts = parseUgcScripts(ugcRaw, angle)

  const result: GeneratedCreatives = {
    campaign_id: campaignId,
    campaign_name: diagnosis.campaign_name,
    diagnosis,
    angle_used: angle,
    hooks,
    copies,
    headlines,
    ctas,
    ugc_scripts,
    generated_at: new Date().toISOString(),
  }
  return result
}

// ─── 4) Critique (streaming) ───

export interface CritiqueParams {
  userId: string
  campaignId?: string                   // contexto opcional
  creative_text: string
  type_hint?: 'hook' | 'copy' | 'headline' | 'cta' | 'ugc_script' | 'ad'
}

export async function streamCritique(params: CritiqueParams) {
  let diagnosis: CreativeDiagnosis | null = null
  if (params.campaignId) {
    diagnosis = await buildDiagnosis(params.userId, params.campaignId)
  }

  const system = buildCriticSystemPrompt({ diagnosis, creative_text: params.creative_text, type_hint: params.type_hint })
  const user = buildCriticUserMessage({ diagnosis, creative_text: params.creative_text, type_hint: params.type_hint })

  const cfg = getRoleConfig('CRITIC')
  const baseOptions = {
    system,
    messages: [{ role: 'user' as const, content: user }],
    maxOutputTokens: cfg.maxOutputTokens,
    timeout: 30000,
  }

  try {
    const result = streamText({ model: getModel('CRITIC'), ...baseOptions })
    return result.toUIMessageStreamResponse()
  } catch {
    const result = streamText({ model: getFallbackModel('CRITIC'), ...baseOptions })
    return result.toUIMessageStreamResponse()
  }
}

// ═══════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════

function empty(reason: 'no_meta' | 'no_sync' | 'all_stable', message: string): CreativeLabEmpty {
  return {
    state: 'empty',
    reason,
    message,
    cta: reason === 'no_meta'
      ? { label: 'Conectar Meta', action: 'connect_meta' }
      : reason === 'no_sync'
        ? { label: 'Sincronizar ahora', action: 'sync' }
        : undefined,
  }
}

function computePriority(p: {
  action: RecommendationAction | null
  primarySignalType: SignalType | null
  classification: CampaignClassification
  ctr: number
}): number {
  // Lower = más urgente. 99 = no relevante creativamente.
  if (p.action === 'REVIEW_CREATIVE' || p.action === 'FIX_LANDING') return 1
  if (p.primarySignalType === 'creative_fatigue') return 2
  if (p.primarySignalType === 'low_ctr') return 3
  if (p.primarySignalType === 'landing_problem') return 4
  if (p.primarySignalType === 'high_cpa') return 5
  if (p.primarySignalType === 'audience_saturation') return 6
  if (p.classification === 'at_risk' || p.classification === 'loser') return 7
  if (p.classification === 'winner' && p.ctr > 1.5) return 8  // permite generar variantes para A/B
  return 99
}

interface Totals { spend: number; ctr: number; cpa: number; roas: number }

async function loadTotals(
  supabase: Awaited<ReturnType<typeof createClient>>,
  campaignIds: string[]
): Promise<Map<string, Totals>> {
  const out = new Map<string, Totals>()
  if (campaignIds.length === 0) return out

  const { data } = await supabase
    .from('ad_insights_daily')
    .select('campaign_id, spend, conversion_value, conversions, clicks, impressions')
    .in('campaign_id', campaignIds)
    .order('date', { ascending: false })

  if (!data) return out

  const counters = new Map<string, number>()
  const accum = new Map<string, { spend: number; revenue: number; conversions: number; clicks: number; impressions: number }>()

  for (const row of data) {
    const cid = row.campaign_id as string
    const seen = counters.get(cid) ?? 0
    if (seen >= 7) continue
    counters.set(cid, seen + 1)
    const a = accum.get(cid) ?? { spend: 0, revenue: 0, conversions: 0, clicks: 0, impressions: 0 }
    a.spend += Number(row.spend) || 0
    a.revenue += Number(row.conversion_value) || 0
    a.conversions += Number(row.conversions) || 0
    a.clicks += Number(row.clicks) || 0
    a.impressions += Number(row.impressions) || 0
    accum.set(cid, a)
  }

  for (const [cid, a] of accum) {
    out.set(cid, {
      spend: r2(a.spend),
      ctr: a.impressions > 0 ? r2((a.clicks / a.impressions) * 100) : 0,
      cpa: a.conversions > 0 ? r2(a.spend / a.conversions) : 0,
      roas: a.spend > 0 ? r2(a.revenue / a.spend) : 0,
    })
  }
  return out
}

function diagnose(
  signal: SignalType | undefined,
  action: RecommendationAction | undefined,
  totals: Totals
) {
  switch (signal) {
    case 'creative_fatigue':
      return {
        problem: 'Fatiga creativa',
        affected_metric: `Frecuencia alta con CTR ${totals.ctr.toFixed(2)}%`,
        probable_cause: 'La audiencia ya vio el anuncio demasiadas veces — el ángulo dejó de funcionar.',
        creative_goal: 'Abrir un ángulo NUEVO. Hook distinto, formato distinto, voz distinta. No retoque del actual.',
      }
    case 'low_ctr':
      return {
        problem: 'CTR bajo',
        affected_metric: `CTR ${totals.ctr.toFixed(2)}%`,
        probable_cause: 'El hook no detiene el scroll. El primer segundo no engancha.',
        creative_goal: 'Crear un hook más directo, específico y emocional. Datos concretos > adjetivos.',
      }
    case 'high_cpa':
      return {
        problem: 'CPA alto',
        affected_metric: `CPA $${totals.cpa.toFixed(2)}`,
        probable_cause: 'El creativo trae tráfico que no convierte — falta calificar al lector o la oferta no es clara.',
        creative_goal: 'Calificar la audiencia desde el hook. Ser explícito sobre para quién es la oferta.',
      }
    case 'landing_problem':
      return {
        problem: 'Problema en la landing',
        affected_metric: `${totals.ctr.toFixed(2)}% CTR pero conversiones bajas`,
        probable_cause: 'El creativo funciona, pero la landing no convierte el tráfico.',
        creative_goal: 'Alinear creativo y landing. El creativo debe prometer EXACTAMENTE lo que el usuario verá al hacer click.',
      }
    case 'audience_saturation':
      return {
        problem: 'Audiencia saturada',
        affected_metric: 'Frecuencia alta con CTR aún saludable',
        probable_cause: 'Estás llegando a la misma gente repetidamente — el alcance se está agotando.',
        creative_goal: 'Generar un creativo que ataque un ángulo o segmento DISTINTO al actual.',
      }
    default:
      if (action === 'REVIEW_CREATIVE') {
        return {
          problem: 'Cambiar creativo',
          affected_metric: `Score y CTR por debajo del esperado`,
          probable_cause: 'El sistema detectó que el creativo actual no está rindiendo.',
          creative_goal: 'Generar variantes con ángulos distintos para test A/B.',
        }
      }
      return {
        problem: 'Optimización creativa',
        affected_metric: `CTR ${totals.ctr.toFixed(2)}%`,
        probable_cause: 'Sin problema crítico — generar variantes para A/B test.',
        creative_goal: 'Crear 2-3 ángulos distintos para identificar cuál performa mejor.',
      }
  }
}

// ─── LLM call wrapper (CREATIVE_GEN role, automatic fallback on error) ───

async function callJson(prompt: string): Promise<string> {
  try {
    const { text } = await generateText({ model: getModel('CREATIVE_GEN'), prompt })
    return text
  } catch {
    const { text } = await generateText({ model: getFallbackModel('CREATIVE_GEN'), prompt })
    return text
  }
}

// ─── Parsers (best-effort, never throw) ───

interface RawAngled { angle?: string; text?: string; body?: string }

function safeParse(raw: string): unknown {
  try {
    // Strip ```json ... ``` fences if present
    const cleaned = raw.replace(/^```(json)?/i, '').replace(/```$/, '').trim()
    return JSON.parse(cleaned)
  } catch {
    // Try to find first { and last }
    const start = raw.indexOf('{')
    const end = raw.lastIndexOf('}')
    if (start >= 0 && end > start) {
      try { return JSON.parse(raw.slice(start, end + 1)) } catch { /* noop */ }
    }
    return null
  }
}

const VALID_ANGLES: CreativeAngle[] = ['auto', 'pain', 'benefit', 'social_proof', 'urgency', 'comparison', 'before_after', 'demonstration']

function normAngle(a: unknown, fallback: CreativeAngle): CreativeAngle {
  if (typeof a === 'string' && VALID_ANGLES.includes(a as CreativeAngle)) return a as CreativeAngle
  return fallback === 'auto' ? 'benefit' : fallback
}

function parseHooks(raw: string, fallback: CreativeAngle): HookVariant[] {
  const obj = safeParse(raw) as { hooks?: RawAngled[] } | null
  const arr = obj?.hooks
  if (!Array.isArray(arr)) return []
  return arr
    .map(h => ({ angle: normAngle(h.angle, fallback), text: typeof h.text === 'string' ? h.text.trim() : '' }))
    .filter(h => h.text.length > 0)
    .slice(0, 5)
}

function parseCopies(raw: string, fallback: CreativeAngle): CopyVariant[] {
  const obj = safeParse(raw) as { copies?: RawAngled[] } | null
  const arr = obj?.copies
  if (!Array.isArray(arr)) return []
  return arr
    .map(c => ({ angle: normAngle(c.angle, fallback), body: typeof c.body === 'string' ? c.body.trim() : '' }))
    .filter(c => c.body.length > 0)
    .slice(0, 3)
}

function parseHeadlines(raw: string, fallback: CreativeAngle): HeadlineVariant[] {
  const obj = safeParse(raw) as { headlines?: RawAngled[] } | null
  const arr = obj?.headlines
  if (!Array.isArray(arr)) return []
  return arr
    .map(h => ({ angle: normAngle(h.angle, fallback), text: typeof h.text === 'string' ? h.text.trim() : '' }))
    .filter(h => h.text.length > 0)
    .slice(0, 3)
}

function parseCtas(raw: string, fallback: CreativeAngle): CtaVariant[] {
  const obj = safeParse(raw) as { ctas?: RawAngled[] } | null
  const arr = obj?.ctas
  if (!Array.isArray(arr)) return []
  return arr
    .map(c => ({ angle: normAngle(c.angle, fallback), text: typeof c.text === 'string' ? c.text.trim() : '' }))
    .filter(c => c.text.length > 0)
    .slice(0, 3)
}

interface RawScript { angle?: string; duration_seconds?: number; hook?: string; body?: string; cta?: string }

function parseUgcScripts(raw: string, fallback: CreativeAngle): UgcScript[] {
  const obj = safeParse(raw) as { scripts?: RawScript[] } | null
  const arr = obj?.scripts
  if (!Array.isArray(arr)) return []
  return arr
    .map(s => ({
      angle: normAngle(s.angle, fallback),
      duration_seconds: s.duration_seconds === 30 ? 30 : 15,
      hook: typeof s.hook === 'string' ? s.hook.trim() : '',
      body: typeof s.body === 'string' ? s.body.trim() : '',
      cta: typeof s.cta === 'string' ? s.cta.trim() : '',
    }))
    .filter(s => s.hook.length > 0 && s.body.length > 0 && s.cta.length > 0)
    .slice(0, 2)
}

function groupBy<T, K>(arr: T[], keyFn: (item: T) => K): Map<K, T[]> {
  const map = new Map<K, T[]>()
  for (const item of arr) {
    const key = keyFn(item)
    const list = map.get(key) ?? []
    list.push(item)
    map.set(key, list)
  }
  return map
}

const r2 = (n: number) => Math.round(n * 100) / 100
