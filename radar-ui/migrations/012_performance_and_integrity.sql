-- ── Migration 012: Performance and Operational Integrity ──────────────────────
--
-- Addresses audit findings from session D/E:
--
--   A. strategic_insights missing indexes — is_major filter + org/time dedup check
--   B. alerts missing index — org-scoped count query in check-signals (isFirstSignal)
--   C. competitor_momentum missing index — momentum_state transition detection
--   D. momentum_history missing partial index — prune/TTL queries
--   E. positioning_history missing index — time-series lookups per competitor
--
-- Run this in your Supabase SQL editor.

-- ── A. strategic_insights ─────────────────────────────────────────────────────

-- The strategic-analysis cron queries (org_id, is_major) to send emails,
-- and (org_id, created_at) for the one-hour idempotency guard + daily delete.

CREATE INDEX IF NOT EXISTS strategic_insights_org_created_at_idx
  ON strategic_insights (org_id, created_at DESC);

CREATE INDEX IF NOT EXISTS strategic_insights_is_major_idx
  ON strategic_insights (is_major)
  WHERE is_major = true;

-- ── B. alerts ─────────────────────────────────────────────────────────────────

-- check-signals does a COUNT(*) per org to detect first-ever signal.
-- The existing compound index alerts_org_read_created_idx covers (org_id, read, created_at).
-- Add a simpler org-only index for the head-only count query.

CREATE INDEX IF NOT EXISTS alerts_org_id_idx
  ON alerts (org_id);

-- ── C. competitor_momentum ────────────────────────────────────────────────────

-- update-momentum loads all rows per org to build prevStateMap.
-- The UNIQUE constraint on (org_id, competitor_id) already acts as an index.
-- Add index on momentum_state for future state-filtered analytics queries.

CREATE INDEX IF NOT EXISTS competitor_momentum_state_idx
  ON competitor_momentum (momentum_state);

CREATE INDEX IF NOT EXISTS competitor_momentum_org_id_idx
  ON competitor_momentum (org_id);

-- ── D. momentum_history ───────────────────────────────────────────────────────

-- Time-series queries by (org_id, competitor_id, recorded_at).
-- Migration 005 may have created this — guard with IF NOT EXISTS.

CREATE INDEX IF NOT EXISTS momentum_history_org_competitor_recorded_idx
  ON momentum_history (org_id, competitor_id, recorded_at DESC);

-- Partial index to efficiently find the most recent snapshot per competitor.
CREATE INDEX IF NOT EXISTS momentum_history_recent_idx
  ON momentum_history (recorded_at DESC);

-- ── E. positioning_history ────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS positioning_history_org_competitor_recorded_idx
  ON positioning_history (org_id, competitor_id, recorded_at DESC);

-- ── F. weekly_briefs ──────────────────────────────────────────────────────────

-- Briefs are queried by org_id (null = system-wide) and generated_at desc.

CREATE INDEX IF NOT EXISTS weekly_briefs_generated_at_idx
  ON weekly_briefs (generated_at DESC);
