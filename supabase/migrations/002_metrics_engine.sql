-- ╔══════════════════════════════════════════════════════════════╗
-- ║  AdPilot — Día 3: Metrics Engine persistence                ║
-- ║  campaign_scores + campaign_signals (versionados)           ║
-- ╚══════════════════════════════════════════════════════════════╝

-- ─── CAMPAIGN SCORES (snapshot por fecha) ───
CREATE TABLE IF NOT EXISTS campaign_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL,
  time_window TEXT NOT NULL DEFAULT 'last_7d' CHECK (time_window IN ('last_1d', 'last_3d', 'last_7d', 'last_14d')),
  score INTEGER NOT NULL CHECK (score >= 0 AND score <= 100),
  confidence TEXT NOT NULL CHECK (confidence IN ('low', 'medium', 'high')),
  classification TEXT NOT NULL CHECK (classification IN ('winner', 'healthy', 'at_risk', 'loser', 'learning', 'no_data')),
  -- Snapshot of metrics that produced this score (for audit)
  metrics_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_current BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, campaign_id, snapshot_date, time_window)
);

-- ─── CAMPAIGN SIGNALS (señales detectadas, una por tipo+fecha) ───
CREATE TABLE IF NOT EXISTS campaign_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL,
  time_window TEXT NOT NULL DEFAULT 'last_7d',
  signal_type TEXT NOT NULL CHECK (signal_type IN (
    'creative_fatigue',
    'zombie_campaign',
    'high_cpa',
    'low_ctr',
    'ready_to_scale',
    'landing_problem',
    'audience_saturation',
    'overspend',
    'underspend',
    'learning_limited'
  )),
  severity TEXT NOT NULL CHECK (severity IN ('critical', 'high', 'medium', 'low')),
  confidence TEXT NOT NULL CHECK (confidence IN ('low', 'medium', 'high')),
  explanation TEXT NOT NULL,
  impact_value NUMERIC(12, 2) NOT NULL DEFAULT 0,
  impact_type TEXT NOT NULL DEFAULT 'opportunity' CHECK (impact_type IN ('opportunity', 'loss_prevention')),
  triggered_metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_current BOOLEAN NOT NULL DEFAULT TRUE,
  resolved_at TIMESTAMPTZ,
  resolved_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, campaign_id, snapshot_date, signal_type, time_window)
);

-- ─── INDEXES ───
CREATE INDEX IF NOT EXISTS idx_scores_user_current ON campaign_scores(user_id, is_current) WHERE is_current = TRUE;
CREATE INDEX IF NOT EXISTS idx_scores_campaign_date ON campaign_scores(campaign_id, snapshot_date DESC);
CREATE INDEX IF NOT EXISTS idx_signals_user_current ON campaign_signals(user_id, is_current) WHERE is_current = TRUE;
CREATE INDEX IF NOT EXISTS idx_signals_campaign_date ON campaign_signals(campaign_id, snapshot_date DESC);
CREATE INDEX IF NOT EXISTS idx_signals_type ON campaign_signals(signal_type) WHERE is_current = TRUE;

-- ─── RLS ───
ALTER TABLE campaign_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_signals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "scores_all_own" ON campaign_scores;
CREATE POLICY "scores_all_own" ON campaign_scores FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "signals_all_own" ON campaign_signals;
CREATE POLICY "signals_all_own" ON campaign_signals FOR ALL USING (auth.uid() = user_id);
