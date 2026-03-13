-- ── Migration 016: Cron Heartbeats + History Pruning Indexes ─────────────────
--
-- 1. cron_heartbeats — operational visibility for all Vercel cron routes
--    One row per route, upserted on each successful run.
--    Read by /api/health for stale-job detection.
--
-- 2. Pruning indexes for momentum_history + positioning_history
--    These tables grow as (orgs × competitors × runs/day) with no upper bound.
--    Efficient DELETE WHERE recorded_at < cutoff requires plain recorded_at index.
--
-- Run in Supabase SQL Editor.

-- ── Cron heartbeats ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS cron_heartbeats (
  route           TEXT        PRIMARY KEY,
  last_run_at     TIMESTAMPTZ NOT NULL,
  status          TEXT        NOT NULL DEFAULT 'ok',  -- ok | error | skipped
  duration_ms     INTEGER,
  rows_processed  INTEGER,
  detail          TEXT
);

-- Written only by service-role cron routes. No RLS needed.

-- ── Pruning indexes ───────────────────────────────────────────────────────────

-- momentum_history: migration 012 has (recorded_at DESC) — also add plain ASC
-- so DELETE WHERE recorded_at < cutoff can use a forward scan efficiently.

CREATE INDEX IF NOT EXISTS momentum_history_recorded_at_asc_idx
  ON momentum_history (recorded_at ASC);

-- positioning_history: existing index is (org_id, competitor_id, recorded_at DESC).
-- Plain recorded_at index for bulk pruning queries.

CREATE INDEX IF NOT EXISTS positioning_history_recorded_at_asc_idx
  ON positioning_history (recorded_at ASC);
