// AdPilot — Scoring: clasificación de campañas (rules-first).
// Función pura sobre MetricSet → winner | healthy | at_risk | loser | learning | no_data.

import { DEFAULT_CONFIG, type ScoringConfig } from './config'
import type { CampaignClassification, MetricSet } from './types'

export function classifyCampaign(
  m: MetricSet,
  config: ScoringConfig = DEFAULT_CONFIG
): CampaignClassification {
  // No data at all (campaña recién creada, no ha gastado nada)
  if (m.spend === 0 && m.impressions === 0) return 'no_data'

  // Learning: muy poco spend, no se puede juzgar todavía
  if (m.spend < config.newCampaignMaxSpend) return 'learning'
  if (m.impressions < config.learningMinImpressions && m.spend < 15) return 'learning'

  // Revenue-tracked: ROAS-based
  if (m.hasRevenue) {
    if (m.roas >= config.targetROAS * 1.5) return 'winner'
    if (m.roas >= config.targetROAS) return 'healthy'
    if (m.roas >= 1.0) return 'at_risk'
    if (m.conversions === 0 && m.spend > config.zombieMinSpend) return 'loser'
    return 'loser'
  }

  // No revenue tracking (engagement, traffic, awareness): CTR-based
  if (m.ctr >= 3.0 && m.cpc < 0.10) return 'winner'
  if (m.ctr >= 1.5 && m.cpc < 0.50) return 'winner'
  if (m.ctr >= config.minCTR) return 'healthy'
  if (m.ctr >= config.minCTR * 0.5) return 'at_risk'
  if (m.spend > 10) return 'loser'

  return 'at_risk'
}
