-- ╔══════════════════════════════════════════════════════╗
-- ║  AdPilot — Database Schema (Supabase / PostgreSQL)  ║
-- ╚══════════════════════════════════════════════════════╝

-- Ad Accounts
CREATE TABLE IF NOT EXISTS ad_accounts (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  timezone TEXT NOT NULL DEFAULT 'America/New_York',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Campaigns
CREATE TABLE IF NOT EXISTS campaigns (
  id TEXT PRIMARY KEY,
  ad_account_id TEXT NOT NULL REFERENCES ad_accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'PAUSED', 'DELETED', 'ARCHIVED')),
  objective TEXT NOT NULL CHECK (objective IN ('OUTCOME_SALES', 'OUTCOME_LEADS', 'OUTCOME_TRAFFIC', 'OUTCOME_ENGAGEMENT', 'OUTCOME_AWARENESS')),
  daily_budget NUMERIC(12,2) NOT NULL DEFAULT 0,
  lifetime_budget NUMERIC(12,2),
  delivery_status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (delivery_status IN ('ACTIVE', 'PAUSED', 'LEARNING', 'LEARNING_LIMITED', 'CAMPAIGN_PAUSED', 'ADSET_PAUSED', 'WITH_ISSUES')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ad Sets
CREATE TABLE IF NOT EXISTS ad_sets (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  daily_budget NUMERIC(12,2) NOT NULL DEFAULT 0,
  delivery_status TEXT NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ads
CREATE TABLE IF NOT EXISTS ads (
  id TEXT PRIMARY KEY,
  ad_set_id TEXT NOT NULL REFERENCES ad_sets(id) ON DELETE CASCADE,
  campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  creative_type TEXT NOT NULL DEFAULT 'IMAGE' CHECK (creative_type IN ('IMAGE', 'VIDEO', 'CAROUSEL')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Daily Insights (one row per campaign per day)
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

-- Alerts
CREATE TABLE IF NOT EXISTS alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  campaign_name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('PAUSE', 'REDUCE_BUDGET', 'SCALE', 'DUPLICATE', 'CHANGE_CREATIVE', 'CHANGE_TARGETING')),
  severity TEXT NOT NULL CHECK (severity IN ('critical', 'high', 'medium', 'low')),
  problem TEXT NOT NULL,
  impact TEXT NOT NULL,
  action TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_insights_campaign_date ON ad_insights_daily(campaign_id, date);
CREATE INDEX IF NOT EXISTS idx_insights_date ON ad_insights_daily(date);
CREATE INDEX IF NOT EXISTS idx_alerts_severity ON alerts(severity);
CREATE INDEX IF NOT EXISTS idx_alerts_unread ON alerts(is_read) WHERE is_read = FALSE;
CREATE INDEX IF NOT EXISTS idx_campaigns_account ON campaigns(ad_account_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status);

-- RLS Policies (básicas para MVP)
ALTER TABLE ad_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE ad_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE ads ENABLE ROW LEVEL SECURITY;
ALTER TABLE ad_insights_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;

-- Permitir lectura a usuarios autenticados (MVP: single user)
CREATE POLICY "Users can read own ad accounts" ON ad_accounts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can read campaigns" ON campaigns FOR SELECT USING (
  ad_account_id IN (SELECT id FROM ad_accounts WHERE user_id = auth.uid())
);
CREATE POLICY "Users can read ad sets" ON ad_sets FOR SELECT USING (
  campaign_id IN (SELECT id FROM campaigns WHERE ad_account_id IN (SELECT id FROM ad_accounts WHERE user_id = auth.uid()))
);
CREATE POLICY "Users can read ads" ON ads FOR SELECT USING (
  campaign_id IN (SELECT id FROM campaigns WHERE ad_account_id IN (SELECT id FROM ad_accounts WHERE user_id = auth.uid()))
);
CREATE POLICY "Users can read insights" ON ad_insights_daily FOR SELECT USING (
  campaign_id IN (SELECT id FROM campaigns WHERE ad_account_id IN (SELECT id FROM ad_accounts WHERE user_id = auth.uid()))
);
CREATE POLICY "Users can read alerts" ON alerts FOR SELECT USING (
  campaign_id IN (SELECT id FROM campaigns WHERE ad_account_id IN (SELECT id FROM ad_accounts WHERE user_id = auth.uid()))
);
