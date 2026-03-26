-- Migration 059: Auto-Quarantine System
-- Adds failure tracking and quarantine state for persistently failing monitored pages

-- Add failure tracking columns to monitored_pages
ALTER TABLE monitored_pages
  ADD COLUMN IF NOT EXISTS consecutive_failures INTEGER DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS quarantined_at TIMESTAMPTZ;

-- Update health_state CHECK constraint to include 'quarantined'
ALTER TABLE monitored_pages
  DROP CONSTRAINT IF EXISTS monitored_pages_health_state_check;

ALTER TABLE monitored_pages
  ADD CONSTRAINT monitored_pages_health_state_check
  CHECK (health_state IN ('healthy', 'blocked', 'challenge', 'degraded', 'baseline_maturing', 'unresolved', 'quarantined'));

-- Create quarantined_pages audit log
CREATE TABLE IF NOT EXISTS quarantined_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  monitored_page_id UUID NOT NULL REFERENCES monitored_pages(id) ON DELETE CASCADE,
  competitor_id UUID NOT NULL REFERENCES competitors(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  page_type TEXT NOT NULL,
  reason TEXT NOT NULL, -- 'consecutive_failures' | 'manual'
  consecutive_failures INTEGER,
  quarantined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for ops dashboard queries
CREATE INDEX IF NOT EXISTS idx_quarantined_pages_quarantined_at ON quarantined_pages(quarantined_at DESC);
CREATE INDEX IF NOT EXISTS idx_quarantined_pages_competitor ON quarantined_pages(competitor_id);

-- Index for fetch-snapshots quarantine checks
CREATE INDEX IF NOT EXISTS idx_monitored_pages_consecutive_failures ON monitored_pages(consecutive_failures) WHERE active = true;

COMMENT ON TABLE quarantined_pages IS 'Audit log of automatically quarantined pages that failed 10+ consecutive fetches over 7+ days';
COMMENT ON COLUMN monitored_pages.consecutive_failures IS 'Count of consecutive fetch failures; reset to 0 on successful fetch';
COMMENT ON COLUMN monitored_pages.quarantined_at IS 'Timestamp when page was automatically quarantined; null if active';
