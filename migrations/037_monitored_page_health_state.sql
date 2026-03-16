-- =============================================================================
-- Migration: 037_monitored_page_health_state.sql
-- Purpose:   Add health_state to monitored_pages to track per-page observability
--            state across fetch, extraction, and baseline pipeline stages.
--
-- States:
--   healthy          → fetch + extraction functioning normally
--   blocked          → explicit 403 / WAF / robots block (persistent)
--   challenge        → interstitial or challenge page returned (Cloudflare etc.)
--   degraded         → fetch succeeds but section extraction repeatedly fails
--   baseline_maturing → sections extracted but baseline not yet confirmed
--   unresolved       → validation incomplete, unknown state, or not yet evaluated
--
-- State ownership (multi-stage):
--   fetch-snapshots  → sets: healthy, blocked, challenge, unresolved
--   extract-sections → may downgrade: healthy → degraded
--   build-baselines  → transitions: unresolved/healthy → baseline_maturing → healthy
--
-- Default for ALL rows (new and existing):
--   'unresolved' — existing pages are re-evaluated through normal pipeline cycles.
--   DO NOT default to 'healthy' — existing pages must earn their state.
--
-- Safe: idempotent (ADD COLUMN IF NOT EXISTS). Apply via Supabase SQL editor.
-- =============================================================================

BEGIN;

ALTER TABLE monitored_pages
  ADD COLUMN IF NOT EXISTS health_state TEXT NOT NULL DEFAULT 'unresolved'
  CONSTRAINT monitored_pages_health_state_check
    CHECK (health_state IN (
      'healthy',
      'blocked',
      'challenge',
      'degraded',
      'baseline_maturing',
      'unresolved'
    ));

-- Index for coverage summary queries (aggregated per org via competitor_id join).
CREATE INDEX IF NOT EXISTS idx_monitored_pages_health_state
  ON monitored_pages (health_state);

COMMIT;
