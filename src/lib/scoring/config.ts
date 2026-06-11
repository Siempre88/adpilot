// AdPilot — Scoring config: thresholds determinísticos.
// Defaults globales para MVP. Más adelante: por usuario.

export interface ScoringConfig {
  // Targets (lo que se considera "saludable")
  targetCPA: number              // $ máximo aceptable por conversión
  targetROAS: number             // ROAS mínimo para considerar saludable
  minCTR: number                 // % CTR mínimo
  maxFrequency: number           // exposiciones máximas antes de fatiga

  // Umbrales para señales
  zombieMinSpend: number         // $ gastados antes de marcar zombie
  zombieMinSpendStrict: number   // $ aún más alto = critical
  scaleMinSpend: number          // $ mínimo antes de proponer escalar
  scaleMinROAS: number           // ROAS mínimo para escalar
  scaleMinScore: number          // score mínimo para escalar
  fatigueFrequencyMin: number    // frecuencia que dispara fatiga
  fatigueCTRMax: number          // CTR debajo del cual + fatigueFreq = fatiga
  highCPAFactor: number          // CPA real / target × este factor = high_cpa
  newCampaignMaxSpend: number    // bajo esto = "new/learning"
  learningMinImpressions: number // mínimo para salir de learning
}

export const DEFAULT_CONFIG: ScoringConfig = {
  targetCPA: 15,
  targetROAS: 2.0,
  minCTR: 0.8,
  maxFrequency: 2.5,
  zombieMinSpend: 20,
  zombieMinSpendStrict: 50,
  scaleMinSpend: 30,
  scaleMinROAS: 2.5,
  scaleMinScore: 70,
  fatigueFrequencyMin: 2.5,
  fatigueCTRMax: 1.0,
  highCPAFactor: 1.5,
  newCampaignMaxSpend: 5,
  learningMinImpressions: 1000,
}
