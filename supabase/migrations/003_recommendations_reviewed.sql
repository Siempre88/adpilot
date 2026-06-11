-- ╔══════════════════════════════════════════════════════════════╗
-- ║  AdPilot — Día 5: Recommendations Center                    ║
-- ║  Add reviewed_at flag for "Mark as reviewed" interaction    ║
-- ╚══════════════════════════════════════════════════════════════╝

ALTER TABLE recommendations
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_recs_user_unreviewed
  ON recommendations(user_id, is_current)
  WHERE is_current = TRUE AND reviewed_at IS NULL;
