-- ╔══════════════════════════════════════════════════════════════╗
-- ║  AdPilot — Full Schema Migration                            ║
-- ║  Tables for: auth, sync, automation engine, action queue    ║
-- ╚══════════════════════════════════════════════════════════════╝

-- ─── PROFILES ───
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'pro')),
  onboarding_done BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ─── META CONNECTIONS (per-user Meta tokens) ───
CREATE TABLE IF NOT EXISTS meta_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ad_account_id TEXT NOT NULL,
  access_token TEXT NOT NULL,
  token_status TEXT NOT NULL DEFAULT 'active' CHECK (token_status IN ('active', 'expired', 'invalid')),
  account_name TEXT,
  connected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  UNIQUE(user_id, ad_account_id)
);

-- ─── AD ACCOUNTS ───
CREATE TABLE IF NOT EXISTS ad_accounts (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  timezone TEXT NOT NULL DEFAULT 'America/New_York',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── CAMPAIGNS ───
CREATE TABLE IF NOT EXISTS campaigns (
  id TEXT PRIMARY KEY,
  ad_account_id TEXT NOT NULL REFERENCES ad_accounts(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  objective TEXT NOT NULL DEFAULT 'OUTCOME_SALES',
  daily_budget NUMERIC(12,2) NOT NULL DEFAULT 0,
  lifetime_budget NUMERIC(12,2),
  delivery_status TEXT NOT NULL DEFAULT 'ACTIVE',
  sync_status TEXT NOT NULL DEFAULT 'pending',
  last_synced_at TIMESTAMPTZ,
  meta_created_at TIMESTAMPTZ,
  meta_updated_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── AD SETS ───
CREATE TABLE IF NOT EXISTS ad_sets (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  daily_budget NUMERIC(12,2) NOT NULL DEFAULT 0,
  delivery_status TEXT NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── ADS ───
CREATE TABLE IF NOT EXISTS ads (
  id TEXT PRIMARY KEY,
  ad_set_id TEXT NOT NULL REFERENCES ad_sets(id) ON DELETE CASCADE,
  campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  creative_type TEXT NOT NULL DEFAULT 'IMAGE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── DAILY INSIGHTS ───
CREATE TABLE IF NOT EXISTS ad_insights_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  ad_set_id TEXT REFERENCES ad_sets(id) ON DELETE SET NULL,
  ad_id TEXT REFERENCES ads(id) ON DELETE SET NULL,
  date DATE NOT NULL,
  impressions INTEGER NOT NULL DEFAULT 0,
  clicks INTEGER NOT NULL DEFAULT 0,
  spend NUMERIC(12,2) NOT NULL DEFAULT 0,
  reach INTEGER NOT NULL DEFAULT 0,
  frequency NUMERIC(6,2) NOT NULL DEFAULT 0,
  cpc NUMERIC(8,4) NOT NULL DEFAULT 0,
  cpm NUMERIC(8,4) NOT NULL DEFAULT 0,
  ctr NUMERIC(6,4) NOT NULL DEFAULT 0,
  conversions INTEGER NOT NULL DEFAULT 0,
  conversion_value NUMERIC(12,2) NOT NULL DEFAULT 0,
  cost_per_conversion NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(campaign_id, date)
);

-- ─── ALERTS ───
CREATE TABLE IF NOT EXISTS alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  campaign_name TEXT NOT NULL DEFAULT '',
  type TEXT NOT NULL CHECK (type IN ('PAUSE', 'REDUCE_BUDGET', 'SCALE', 'DUPLICATE', 'CHANGE_CREATIVE', 'CHANGE_TARGETING')),
  severity TEXT NOT NULL CHECK (severity IN ('critical', 'high', 'medium', 'low')),
  problem TEXT NOT NULL,
  impact TEXT NOT NULL,
  action TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  resolved_at TIMESTAMPTZ,
  resolved_reason TEXT,
  snapshot_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── RECOMMENDATIONS ───
CREATE TABLE IF NOT EXISTS recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  label TEXT NOT NULL,
  score INTEGER NOT NULL DEFAULT 0,
  confidence TEXT NOT NULL DEFAULT 'low' CHECK (confidence IN ('low', 'medium', 'high')),
  impact_value NUMERIC(12,2) NOT NULL DEFAULT 0,
  impact_type TEXT NOT NULL DEFAULT 'opportunity' CHECK (impact_type IN ('opportunity', 'loss_prevention')),
  reason TEXT NOT NULL,
  snapshot_date DATE NOT NULL,
  is_current BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── SYNC LOG ───
CREATE TABLE IF NOT EXISTS sync_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sync_type TEXT NOT NULL DEFAULT 'full',
  status TEXT NOT NULL CHECK (status IN ('started', 'completed', 'error')),
  campaigns_synced INTEGER NOT NULL DEFAULT 0,
  insights_synced INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- ─── AUTOMATION SETTINGS ───
CREATE TABLE IF NOT EXISTS automation_settings (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  automation_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  auto_pause_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  auto_scale_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  approval_required BOOLEAN NOT NULL DEFAULT TRUE,
  cool_down_minutes INTEGER NOT NULL DEFAULT 60,
  budget_limit_daily NUMERIC(12,2) NOT NULL DEFAULT 100,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── AUTOMATION RULES ───
CREATE TABLE IF NOT EXISTS automation_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  priority INTEGER NOT NULL DEFAULT 100,
  trigger_type TEXT NOT NULL,
  trigger_operator TEXT NOT NULL DEFAULT '>',
  trigger_value NUMERIC(12,4) NOT NULL DEFAULT 0,
  action_type TEXT NOT NULL,
  action_params JSONB NOT NULL DEFAULT '{}'::jsonb,
  requires_approval BOOLEAN NOT NULL DEFAULT TRUE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── ACTION QUEUE ───
CREATE TABLE IF NOT EXISTS action_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rule_id UUID REFERENCES automation_rules(id) ON DELETE SET NULL,
  campaign_id TEXT NOT NULL,
  campaign_name TEXT NOT NULL,
  action_type TEXT NOT NULL,
  action_params JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'executed', 'expired', 'failed')),
  priority INTEGER NOT NULL DEFAULT 100,
  impact_value NUMERIC(12,2) NOT NULL DEFAULT 0,
  impact_type TEXT,
  reason TEXT NOT NULL,
  requires_approval BOOLEAN NOT NULL DEFAULT TRUE,
  idempotency_hash TEXT UNIQUE,
  approved_at TIMESTAMPTZ,
  approved_by TEXT,
  rejected_at TIMESTAMPTZ,
  rejected_reason TEXT,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── ACTION LOG (immutable audit) ───
CREATE TABLE IF NOT EXISTS action_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action_queue_id UUID REFERENCES action_queue(id) ON DELETE SET NULL,
  campaign_id TEXT NOT NULL,
  campaign_name TEXT NOT NULL,
  action_type TEXT NOT NULL,
  action_params JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL,
  result JSONB,
  impact_value NUMERIC(12,2) NOT NULL DEFAULT 0,
  error_message TEXT,
  executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  execution_mode TEXT NOT NULL DEFAULT 'approved'
);

-- ─── INDEXES ───
CREATE INDEX IF NOT EXISTS idx_meta_conn_user ON meta_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_user ON campaigns(user_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_account ON campaigns(ad_account_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_active ON campaigns(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_insights_campaign_date ON ad_insights_daily(campaign_id, date);
CREATE INDEX IF NOT EXISTS idx_insights_date ON ad_insights_daily(date);
CREATE INDEX IF NOT EXISTS idx_alerts_user ON alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_alerts_unresolved ON alerts(user_id) WHERE resolved_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_recs_user_current ON recommendations(user_id, is_current);
CREATE INDEX IF NOT EXISTS idx_synclog_user ON sync_log(user_id, status);
CREATE INDEX IF NOT EXISTS idx_actionq_user_status ON action_queue(user_id, status);
CREATE INDEX IF NOT EXISTS idx_actionq_campaign ON action_queue(campaign_id);
CREATE INDEX IF NOT EXISTS idx_actionq_idempot ON action_queue(idempotency_hash);
CREATE INDEX IF NOT EXISTS idx_actionlog_user ON action_log(user_id, executed_at DESC);
CREATE INDEX IF NOT EXISTS idx_actionlog_campaign ON action_log(campaign_id);
CREATE INDEX IF NOT EXISTS idx_rules_user_active ON automation_rules(user_id, is_active);

-- ─── ROW LEVEL SECURITY ───
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE meta_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE ad_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE ad_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE ads ENABLE ROW LEVEL SECURITY;
ALTER TABLE ad_insights_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE action_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE action_log ENABLE ROW LEVEL SECURITY;

-- Profiles: own row only
DROP POLICY IF EXISTS "profiles_select_own" ON profiles;
CREATE POLICY "profiles_select_own" ON profiles FOR SELECT USING (auth.uid() = id);
DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE USING (auth.uid() = id);
DROP POLICY IF EXISTS "profiles_insert_own" ON profiles;
CREATE POLICY "profiles_insert_own" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Meta connections
DROP POLICY IF EXISTS "meta_conn_all_own" ON meta_connections;
CREATE POLICY "meta_conn_all_own" ON meta_connections FOR ALL USING (auth.uid() = user_id);

-- Ad accounts
DROP POLICY IF EXISTS "ad_accounts_all_own" ON ad_accounts;
CREATE POLICY "ad_accounts_all_own" ON ad_accounts FOR ALL USING (auth.uid() = user_id);

-- Campaigns
DROP POLICY IF EXISTS "campaigns_all_own" ON campaigns;
CREATE POLICY "campaigns_all_own" ON campaigns FOR ALL USING (auth.uid() = user_id);

-- Ad sets / ads (via campaign)
DROP POLICY IF EXISTS "ad_sets_all_own" ON ad_sets;
CREATE POLICY "ad_sets_all_own" ON ad_sets FOR ALL USING (
  campaign_id IN (SELECT id FROM campaigns WHERE user_id = auth.uid())
);
DROP POLICY IF EXISTS "ads_all_own" ON ads;
CREATE POLICY "ads_all_own" ON ads FOR ALL USING (
  campaign_id IN (SELECT id FROM campaigns WHERE user_id = auth.uid())
);

-- Insights (via campaign)
DROP POLICY IF EXISTS "insights_all_own" ON ad_insights_daily;
CREATE POLICY "insights_all_own" ON ad_insights_daily FOR ALL USING (
  campaign_id IN (SELECT id FROM campaigns WHERE user_id = auth.uid())
);

-- Alerts: own row
DROP POLICY IF EXISTS "alerts_all_own" ON alerts;
CREATE POLICY "alerts_all_own" ON alerts FOR ALL USING (auth.uid() = user_id);

-- Recommendations
DROP POLICY IF EXISTS "recs_all_own" ON recommendations;
CREATE POLICY "recs_all_own" ON recommendations FOR ALL USING (auth.uid() = user_id);

-- Sync log
DROP POLICY IF EXISTS "synclog_all_own" ON sync_log;
CREATE POLICY "synclog_all_own" ON sync_log FOR ALL USING (auth.uid() = user_id);

-- Automation settings/rules/queue/log
DROP POLICY IF EXISTS "auto_settings_all_own" ON automation_settings;
CREATE POLICY "auto_settings_all_own" ON automation_settings FOR ALL USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "auto_rules_all_own" ON automation_rules;
CREATE POLICY "auto_rules_all_own" ON automation_rules FOR ALL USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "action_queue_all_own" ON action_queue;
CREATE POLICY "action_queue_all_own" ON action_queue FOR ALL USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "action_log_all_own" ON action_log;
CREATE POLICY "action_log_all_own" ON action_log FOR ALL USING (auth.uid() = user_id);
