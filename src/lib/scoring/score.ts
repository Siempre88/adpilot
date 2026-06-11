// AdPilot — Scoring: score 0-100 + confidence.
// Función pura sobre MetricSet + clasificación.
// CTR 30 + CPC eff 20 + Spend eff 15 + Conv 20 + Freq 15 = 100.
// Penaliza losers (≤25), learning/no_data (≤50).

import type { CampaignClassification, MetricSet, ScoreResult, RecommendationConfidence } from './types'

export function calculateScore(
  m: MetricSet,
  classification: CampaignClassification
): ScoreResult {
  if (classification === 'no_data') {
    return { score: 0, confidence: 'low' }
  }

  // CTR (0-30)
  const ctrScore = Math.min(30, (m.ctr / 3) * 30)

  // CPC efficiency (0-20)
  const cpcScore =
    m.cpc <= 0.01 ? 20 :
    m.cpc <= 0.05 ? 18 :
    m.cpc <= 0.50 ? 15 :
    m.cpc <= 1.50 ? 10 :
    m.cpc <= 3 ? 5 : 0

  // Spend efficiency (0-15)
  let spendScore = 0
  if (m.hasRevenue && m.roas > 0) {
    spendScore = Math.min(15, (m.roas / 3) * 15)
  } else if (m.conversions > 0 && m.spend > 0) {
    const convPerDollar = m.conversions / m.spend
    spendScore = Math.min(15, convPerDollar * 15)
  } else if (m.ctr > 2) {
    spendScore = 10
  }

  // Conversions (0-20)
  const convScore =
    m.conversions > 0 ? Math.min(20, (m.conversions / 10) * 20) :
    m.ctr > 3 ? 10 : 0

  // Frequency health (0-15) — penaliza saturación
  const freqScore =
    m.frequency <= 1.5 ? 15 :
    m.frequency <= 2.0 ? 12 :
    m.frequency <= 2.5 ? 8 :
    m.frequency <= 3.0 ? 4 : 0

  let total = Math.round(ctrScore + cpcScore + spendScore + convScore + freqScore)

  // Cap by classification
  if (classification === 'loser') total = Math.min(total, 25)
  if (classification === 'learning' || classification === 'new') total = Math.min(total, 50)

  return {
    score: Math.max(0, Math.min(100, total)),
    confidence: scoreConfidence(m),
  }
}

// Confidence basada en volumen de datos.
// Más spend + impresiones + clicks + conversiones = más confianza en el score.
function scoreConfidence(m: MetricSet): RecommendationConfidence {
  let points = 0
  if (m.spend >= 5) points += 1
  if (m.spend >= 15) points += 1
  if (m.spend >= 30) points += 1
  if (m.impressions >= 1000) points += 1
  if (m.impressions >= 5000) points += 1
  if (m.impressions >= 10000) points += 1
  if (m.clicks >= 50) points += 1
  if (m.clicks >= 200) points += 1
  if (m.clicks >= 500) points += 1
  if (m.conversions >= 1) points += 1

  if (points >= 7) return 'high'
  if (points >= 4) return 'medium'
  return 'low'
}
