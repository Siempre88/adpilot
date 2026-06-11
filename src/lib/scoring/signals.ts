// AdPilot — Scoring: detección de señales (rules-first).
// Una señal = regla determinística sobre un MetricSet.
// Cada insight termina en acción → cada Signal mapea a una Recommendation.

import { DEFAULT_CONFIG, type ScoringConfig } from './config'
import type {
  CampaignClassification,
  MetricSet,
  ScoreResult,
  Signal,
  SignalSeverity,
} from './types'

const r2 = (n: number) => Math.round(n * 100) / 100

// ─── Public API ───

export interface SignalContext {
  metrics: MetricSet
  classification: CampaignClassification
  score: ScoreResult
  config?: ScoringConfig
  // Contexto opcional para señales de tendencia (Día 4+):
  prevMetrics?: MetricSet
}

export function detectSignals(ctx: SignalContext): Signal[] {
  const config = ctx.config ?? DEFAULT_CONFIG
  const signals: Signal[] = []

  if (ctx.classification === 'no_data') return signals

  signals.push(...detectZombie(ctx, config))
  signals.push(...detectCreativeFatigue(ctx, config))
  signals.push(...detectLowCtr(ctx, config))
  signals.push(...detectHighCpa(ctx, config))
  signals.push(...detectReadyToScale(ctx, config))
  signals.push(...detectAudienceSaturation(ctx, config))
  signals.push(...detectOverspend(ctx, config))
  signals.push(...detectUnderspend(ctx, config))
  signals.push(...detectLearningLimited(ctx, config))
  signals.push(...detectLandingProblem(ctx, config))

  // Dedup por tipo (mantener mayor severidad)
  const bySeverity: Record<SignalSeverity, number> = { critical: 0, high: 1, medium: 2, low: 3 }
  const map = new Map<Signal['type'], Signal>()
  for (const s of signals) {
    const existing = map.get(s.type)
    if (!existing || bySeverity[s.severity] < bySeverity[existing.severity]) {
      map.set(s.type, s)
    }
  }
  return Array.from(map.values()).sort((a, b) => bySeverity[a.severity] - bySeverity[b.severity])
}

// ─── Individual rules ───
// Each returns [] (no signal) or [signal]. Pure functions.

function detectZombie(ctx: SignalContext, c: ScoringConfig): Signal[] {
  const m = ctx.metrics
  if (m.conversions > 0) return []

  // Excluye objectives donde conversiones no son la meta
  // (esa lógica vive en el caller; acá usamos una regla simple sobre métricas)
  const dailySpend = m.daysCovered > 0 ? m.spend / m.daysCovered : m.spend

  if (m.spend > c.zombieMinSpendStrict) {
    return [{
      type: 'zombie_campaign',
      severity: 'critical',
      confidence: ctx.score.confidence,
      explanation: `$${m.spend.toFixed(2)} gastados sin ninguna conversión. Detener sangrado y revisar oferta antes de relanzar.`,
      impact_value: r2(dailySpend),
      impact_type: 'loss_prevention',
      triggered_metrics: { spend: m.spend, conversions: 0, days: m.daysCovered },
    }]
  }
  if (m.spend > c.zombieMinSpend) {
    return [{
      type: 'zombie_campaign',
      severity: 'high',
      confidence: ctx.score.confidence,
      explanation: `$${m.spend.toFixed(2)} gastados con cero conversiones. Pausar y revisar.`,
      impact_value: r2(dailySpend),
      impact_type: 'loss_prevention',
      triggered_metrics: { spend: m.spend, conversions: 0 },
    }]
  }
  return []
}

function detectCreativeFatigue(ctx: SignalContext, c: ScoringConfig): Signal[] {
  const m = ctx.metrics
  if (m.frequency < c.fatigueFrequencyMin) return []
  if (m.ctr >= c.fatigueCTRMax) return []

  const dailySpend = m.daysCovered > 0 ? m.spend / m.daysCovered : 0
  const severity: SignalSeverity = m.frequency > 4 ? 'high' : 'medium'

  return [{
    type: 'creative_fatigue',
    severity,
    confidence: ctx.score.confidence,
    explanation: `Frecuencia ${m.frequency.toFixed(1)} con CTR ${m.ctr.toFixed(2)}%. La audiencia ya vio el anuncio demasiado. Rotar creativo.`,
    impact_value: r2(dailySpend * 0.3),
    impact_type: 'loss_prevention',
    triggered_metrics: { frequency: m.frequency, ctr: m.ctr },
  }]
}

function detectLowCtr(ctx: SignalContext, c: ScoringConfig): Signal[] {
  const m = ctx.metrics
  if (m.ctr >= c.minCTR) return []
  if (m.impressions < 1000) return []

  const dailySpend = m.daysCovered > 0 ? m.spend / m.daysCovered : 0
  const severity: SignalSeverity = m.ctr < c.minCTR * 0.5 ? 'high' : 'medium'

  return [{
    type: 'low_ctr',
    severity,
    confidence: ctx.score.confidence,
    explanation: `CTR ${m.ctr.toFixed(2)}% por debajo del mínimo (${c.minCTR}%). Hook o creativo no detiene scroll.`,
    impact_value: r2(dailySpend * 0.4),
    impact_type: 'opportunity',
    triggered_metrics: { ctr: m.ctr, impressions: m.impressions, cpc: m.cpc },
  }]
}

function detectHighCpa(ctx: SignalContext, c: ScoringConfig): Signal[] {
  const m = ctx.metrics
  if (m.conversions === 0) return []                // covered by zombie
  if (!m.hasRevenue && m.cpa === 0) return []        // sin tracking
  if (m.cpa <= c.targetCPA * c.highCPAFactor) return []

  const dailyExcess = ((m.cpa - c.targetCPA) * m.conversions) / Math.max(m.daysCovered, 1)
  const severity: SignalSeverity = m.cpa > c.targetCPA * 2 ? 'high' : 'medium'

  return [{
    type: 'high_cpa',
    severity,
    confidence: ctx.score.confidence,
    explanation: `CPA $${m.cpa.toFixed(2)} contra target $${c.targetCPA}. Cada conversión cuesta de más. Revisar segmentación.`,
    impact_value: r2(dailyExcess),
    impact_type: 'opportunity',
    triggered_metrics: { cpa: m.cpa, target_cpa: c.targetCPA, conversions: m.conversions },
  }]
}

function detectReadyToScale(ctx: SignalContext, c: ScoringConfig): Signal[] {
  const m = ctx.metrics
  if (ctx.classification !== 'winner' && ctx.classification !== 'healthy') return []
  if (m.spend < c.scaleMinSpend) return []
  if (ctx.score.score < c.scaleMinScore) return []
  if (m.frequency > c.fatigueFrequencyMin) return []  // fatiga inminente bloquea escalar

  const conditionMet = m.hasRevenue
    ? m.roas >= c.scaleMinROAS
    : m.ctr >= 1.5 && m.cpc < 0.5
  if (!conditionMet) return []

  const dailySpend = m.daysCovered > 0 ? m.spend / m.daysCovered : 0
  const opportunity = m.hasRevenue
    ? r2(dailySpend * 0.25 * (m.roas - 1))
    : r2(dailySpend * 0.25)

  return [{
    type: 'ready_to_scale',
    severity: 'low',
    confidence: ctx.score.confidence,
    explanation: m.hasRevenue
      ? `ROAS ${m.roas.toFixed(1)}x con score ${ctx.score.score}/100. Subir presupuesto 20-25%.`
      : `CTR ${m.ctr.toFixed(1)}% con CPC $${m.cpc.toFixed(2)}. Score ${ctx.score.score}/100. Listo para escalar 20%.`,
    impact_value: opportunity,
    impact_type: 'opportunity',
    triggered_metrics: { score: ctx.score.score, roas: m.roas, ctr: m.ctr, cpc: m.cpc },
  }]
}

function detectAudienceSaturation(ctx: SignalContext, c: ScoringConfig): Signal[] {
  const m = ctx.metrics
  // Saturación = frecuencia muy alta SIN fatiga creativa todavía
  // (CTR aún OK, pero el alcance se está agotando)
  if (m.frequency < c.maxFrequency) return []
  if (m.ctr < c.fatigueCTRMax) return []                 // ya cae bajo creative_fatigue
  if (m.reach === 0) return []

  return [{
    type: 'audience_saturation',
    severity: 'medium',
    confidence: ctx.score.confidence,
    explanation: `Frecuencia ${m.frequency.toFixed(1)} con CTR aún saludable. Audiencia se está agotando — ampliar antes de que caiga el CTR.`,
    impact_value: 0,
    impact_type: 'opportunity',
    triggered_metrics: { frequency: m.frequency, reach: m.reach, ctr: m.ctr },
  }]
}

function detectOverspend(ctx: SignalContext, c: ScoringConfig): Signal[] {
  const m = ctx.metrics
  // Overspend = gasto desproporcionado para resultados pobres
  if (ctx.classification !== 'loser' && ctx.classification !== 'at_risk') return []
  if (m.daysCovered === 0) return []

  const dailySpend = m.spend / m.daysCovered
  // Solo dispara si el daily spend es notablemente alto comparado a target
  if (dailySpend < 10) return []

  return [{
    type: 'overspend',
    severity: 'medium',
    confidence: ctx.score.confidence,
    explanation: `$${dailySpend.toFixed(2)}/día en una campaña ${ctx.classification}. Reducir presupuesto mientras se diagnostica.`,
    impact_value: r2(dailySpend * 0.5),
    impact_type: 'loss_prevention',
    triggered_metrics: { daily_spend: dailySpend, classification: ctx.classification },
  }]
}

function detectUnderspend(ctx: SignalContext, _c: ScoringConfig): Signal[] {
  const m = ctx.metrics
  if (ctx.classification !== 'winner' && ctx.classification !== 'healthy') return []
  if (m.daysCovered === 0) return []

  const dailySpend = m.spend / m.daysCovered
  // Underspend = ganadora con gasto bajo (oportunidad perdida)
  if (dailySpend >= 5) return []
  if (m.spend < 10) return []  // insuficiente para confiar

  return [{
    type: 'underspend',
    severity: 'low',
    confidence: ctx.score.confidence,
    explanation: `Solo $${dailySpend.toFixed(2)}/día en una campaña ganadora. Subir presupuesto para capturar más alcance.`,
    impact_value: r2(dailySpend * 0.5),
    impact_type: 'opportunity',
    triggered_metrics: { daily_spend: dailySpend, classification: ctx.classification },
  }]
}

function detectLearningLimited(ctx: SignalContext, _c: ScoringConfig): Signal[] {
  const m = ctx.metrics
  // Learning limited = pocos eventos de optimización
  if (m.spend < 30) return []
  if (m.conversions >= 10) return []
  if (m.conversions === 0) return []                    // covered by zombie
  if (m.daysCovered < 3) return []                       // todavía es pronto

  return [{
    type: 'learning_limited',
    severity: 'medium',
    confidence: ctx.score.confidence,
    explanation: `${m.conversions} conversiones en ${m.daysCovered} días con $${m.spend.toFixed(2)} gastados. Meta no tiene suficiente señal — ampliar audiencia o consolidar ad sets.`,
    impact_value: 0,
    impact_type: 'opportunity',
    triggered_metrics: { conversions: m.conversions, spend: m.spend, days: m.daysCovered },
  }]
}

function detectLandingProblem(ctx: SignalContext, _c: ScoringConfig): Signal[] {
  const m = ctx.metrics
  // Landing problem = clicks altos pero cero conversiones
  // (señal indirecta: el creativo trae tráfico pero la página no convierte)
  if (m.clicks < 50) return []
  if (m.conversions > 0) return []
  if (m.ctr < 1.0) return []                            // si el CTR es bajo, el problema es el creativo

  return [{
    type: 'landing_problem',
    severity: 'high',
    confidence: ctx.score.confidence,
    explanation: `${m.clicks} clicks sin conversiones, con CTR ${m.ctr.toFixed(2)}% saludable. El creativo funciona pero la landing no. Revisar oferta y página.`,
    impact_value: r2((m.spend / Math.max(m.daysCovered, 1)) * 0.5),
    impact_type: 'loss_prevention',
    triggered_metrics: { clicks: m.clicks, conversions: 0, ctr: m.ctr },
  }]
}
