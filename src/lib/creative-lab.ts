// ─────────────────────────────────────────────────────────────
// AdPilot — Creative Lab
// Analyzes winning campaigns, generates copy + image prompts
// Uses OpenRouter (free) for copy generation
// ─────────────────────────────────────────────────────────────

import { getCampaignsWithMetrics } from '@/lib/meta-ads'
import type {
  CampaignWithMetrics,
  CreativeInsights,
  CreativePattern,
  GeneratedCreative,
} from '@/shared/types/database'

// ─── Pattern Analysis ───

function analyzePatterns(campaigns: CampaignWithMetrics[]): CreativeInsights {
  const winners = campaigns.filter(c => c.classification === 'winner' && c.total_spend > 0)
  const losers = campaigns.filter(c => c.classification === 'loser' && c.total_spend > 0)

  // Extract patterns from campaign names and objectives
  const winningPatterns: CreativePattern[] = []
  const losingPatterns: CreativePattern[] = []

  // Detect common name patterns in winners
  const patternMap = new Map<string, { campaigns: string[]; ctrs: number[] }>()

  for (const c of winners) {
    const name = c.name.toLowerCase()
    let pattern = 'Otro'

    if (name.includes('marketplace') || name.includes('publicación')) {
      pattern = 'Marketplace listing con foto de producto'
    } else if (name.includes('promo') || name.includes('flash') || name.includes('sale')) {
      pattern = 'Promoción directa con urgencia'
    } else if (name.includes('video') || name.includes('reel')) {
      pattern = 'Video o Reel orgánico promocionado'
    } else if (name.includes('lead') || name.includes('ebook') || name.includes('magnet')) {
      pattern = 'Lead magnet con oferta gratuita'
    }

    if (!patternMap.has(pattern)) patternMap.set(pattern, { campaigns: [], ctrs: [] })
    const p = patternMap.get(pattern)!
    p.campaigns.push(c.name)
    p.ctrs.push(c.avg_ctr)
  }

  for (const [pattern, data] of patternMap) {
    winningPatterns.push({
      pattern,
      avg_ctr: Math.round((data.ctrs.reduce((s, c) => s + c, 0) / data.ctrs.length) * 100) / 100,
      sample_campaigns: data.campaigns.slice(0, 3),
      frequency: data.campaigns.length,
    })
  }
  winningPatterns.sort((a, b) => b.avg_ctr - a.avg_ctr)

  // Losing patterns
  for (const c of losers) {
    losingPatterns.push({
      pattern: `${c.name.slice(0, 40)} — CTR ${c.avg_ctr}%`,
      avg_ctr: c.avg_ctr,
      sample_campaigns: [c.name],
      frequency: 1,
    })
  }

  const allCtrs = campaigns.filter(c => c.total_spend > 0).map(c => c.avg_ctr)

  return {
    winning_patterns: winningPatterns,
    losing_patterns: losingPatterns,
    best_ctr: allCtrs.length > 0 ? Math.max(...allCtrs) : 0,
    worst_ctr: allCtrs.length > 0 ? Math.min(...allCtrs) : 0,
    recommendation: winners.length > 0
      ? `Tus campañas ganadoras tienen CTR promedio de ${(winners.reduce((s, c) => s + c.avg_ctr, 0) / winners.length).toFixed(1)}%. El patrón dominante es "${winningPatterns[0]?.pattern || 'variado'}". Replica este formato en campañas nuevas.`
      : 'Sin suficientes campañas ganadoras para extraer patrones.',
  }
}

// ─── Copy Generation via OpenRouter ───

async function generateCopyWithAI(context: {
  campaignName: string
  currentCtr: number
  objective: string
  winningPatterns: CreativePattern[]
  productContext: string
}): Promise<{ headline: string; body: string; cta: string; hook: string; image_prompt: string; rationale: string }> {
  if (!process.env.OPENROUTER_API_KEY) {
    return fallbackCopy(context)
  }

  const winnerInfo = context.winningPatterns
    .slice(0, 3)
    .map(p => `- "${p.pattern}" con CTR promedio ${p.avg_ctr}% (${p.frequency} campañas)`)
    .join('\n')

  const prompt = `Eres un copywriter experto en Facebook Ads. Genera un creativo para esta campaña.

CAMPAÑA: ${context.campaignName}
CTR ACTUAL: ${context.currentCtr}% (necesita mejorar)
OBJETIVO: ${context.objective}
PRODUCTO/CONTEXTO: ${context.productContext}

PATRONES QUE FUNCIONAN EN ESTA CUENTA:
${winnerInfo || 'Sin patrones previos'}

GENERA (en español):
1. HOOK: Una primera línea que detenga el scroll (máximo 8 palabras)
2. HEADLINE: Título del anuncio (máximo 12 palabras)
3. BODY: Texto principal (máximo 3 líneas, directo, con beneficio claro)
4. CTA: Call to action (máximo 5 palabras)
5. IMAGE_PROMPT: Descripción detallada en inglés para generar la imagen del anuncio con IA (estilo, composición, colores, producto, fondo)
6. RATIONALE: Por qué este creativo funcionará mejor que el actual (1 línea con datos)

Responde SOLO en este formato JSON exacto:
{"hook":"...","headline":"...","body":"...","cta":"...","image_prompt":"...","rationale":"..."}`

  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'minimax/minimax-m2.5:free',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 500,
        temperature: 0.8,
      }),
    })

    const data = await res.json()
    const content = data.choices?.[0]?.message?.content || ''

    // Extract JSON from response (may have markdown wrapping)
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0])
      return {
        headline: parsed.headline || 'Headline no generado',
        body: parsed.body || 'Body no generado',
        cta: parsed.cta || 'Ver más',
        hook: parsed.hook || 'Hook no generado',
        image_prompt: parsed.image_prompt || 'Product photo, clean white background, professional lighting',
        rationale: parsed.rationale || 'Basado en patrones de campañas ganadoras',
      }
    }

    return fallbackCopy(context)
  } catch (err) {
    console.error('[Creative Lab] AI generation failed:', err)
    return fallbackCopy(context)
  }
}

function fallbackCopy(context: { campaignName: string; currentCtr: number; winningPatterns: CreativePattern[] }) {
  const topPattern = context.winningPatterns[0]
  return {
    headline: `${context.campaignName.split(']')[0].replace('[', '')} — Oportunidad única`,
    body: `No dejes pasar esta oportunidad. Disponibilidad limitada.\nContacta ahora y asegura el mejor precio.`,
    cta: 'Contactar ahora',
    hook: '¿Buscas esto? Lo tenemos.',
    image_prompt: 'Product photo with clean background, professional studio lighting, high contrast, modern composition, eye-catching colors',
    rationale: topPattern
      ? `Patrón ganador "${topPattern.pattern}" tiene CTR ${topPattern.avg_ctr}%. Tu CTR actual es ${context.currentCtr}%.`
      : `CTR actual de ${context.currentCtr}% está por debajo del promedio. Nuevo creativo necesario.`,
  }
}

// ─── Public API ───

export async function getCreativeInsights(datePreset: string = 'last_7d'): Promise<CreativeInsights> {
  const campaigns = await getCampaignsWithMetrics(datePreset as any)
  return analyzePatterns(campaigns)
}

export async function generateCreative(
  campaignId: string,
  datePreset: string = 'last_7d'
): Promise<GeneratedCreative | { error: string }> {
  const campaigns = await getCampaignsWithMetrics(datePreset as any)
  const campaign = campaigns.find(c => c.id === campaignId)

  if (!campaign) return { error: 'Campaña no encontrada' }

  const insights = analyzePatterns(campaigns)

  // Extract product context from campaign name
  const nameClean = campaign.name
    .replace(/\[|\]/g, '')
    .replace(/Publicación de Marketplace promocionada.*/, '')
    .trim()

  const copy = await generateCopyWithAI({
    campaignName: campaign.name,
    currentCtr: campaign.avg_ctr,
    objective: campaign.objective,
    winningPatterns: insights.winning_patterns,
    productContext: nameClean || campaign.name,
  })

  const winners = campaigns.filter(c => c.classification === 'winner')
  const avgWinnerCtr = winners.length > 0
    ? Math.round((winners.reduce((s, c) => s + c.avg_ctr, 0) / winners.length) * 100) / 100
    : campaign.avg_ctr * 1.5

  return {
    campaign_name: campaign.name,
    campaign_score: campaign.score,
    current_ctr: campaign.avg_ctr,
    target_ctr: avgWinnerCtr,
    headline: copy.headline,
    body: copy.body,
    cta: copy.cta,
    hook: copy.hook,
    image_prompt: copy.image_prompt,
    image_url: null,
    rationale: copy.rationale,
    based_on: insights.winning_patterns.slice(0, 2).flatMap(p => p.sample_campaigns.slice(0, 1)),
  }
}

export async function generateCreativeForWorst(datePreset: string = 'last_7d'): Promise<GeneratedCreative[]> {
  const campaigns = await getCampaignsWithMetrics(datePreset as any)
  const needsCreative = campaigns
    .filter(c => c.total_spend > 0 && (c.classification === 'loser' || (c.classification === 'at_risk' && c.avg_ctr < 2)))
    .sort((a, b) => a.avg_ctr - b.avg_ctr)
    .slice(0, 3)

  const results: GeneratedCreative[] = []
  for (const c of needsCreative) {
    const result = await generateCreative(c.id, datePreset)
    if ('error' in result) continue
    results.push(result)
  }
  return results
}
