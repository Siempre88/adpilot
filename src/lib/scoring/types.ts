// AdPilot — Scoring layer: tipos compartidos.
// Re-exporta tipos de negocio para que el resto del scoring no
// importe paths profundos. Single source of truth: shared/types/database.

export type {
  ActionPlanStep,
  Alert,
  AlertSeverity,
  CampaignClassification,
  CampaignRecommendation,
  CampaignWithMetrics,
  DailyActionPlan,
  DailyPriority,
  DashboardSummary,
  DecisionType,
  EffortLevel,
  ExecutiveSummary,
  ImpactAnalysis,
  MetricSet,
  PriorityAction,
  Recommendation,
  RecommendationAction,
  RecommendationConfidence,
  RecommendationExplanation,
  RecommendationUrgency,
  ScoreResult,
  Signal,
  SignalSeverity,
  SignalType,
  SimulationResult,
  TimeWindow,
} from '@/shared/types/database'

export function r2(n: number): number {
  return Math.round(n * 100) / 100
}
