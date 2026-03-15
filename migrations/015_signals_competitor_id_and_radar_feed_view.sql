-- =============================================================================
-- Migration: 015_signals_competitor_id_and_radar_feed_view.sql
-- Purpose:   Two permanent pipeline repairs:
--
--   1. signals.competitor_id — add and backfill competitor_id on the signals
--      table. The detect-signals handler now writes this field on every insert,
--      but existing rows do not have it. Backfill via monitored_pages join.
--      After backfill, add a nullable-to-NOT NULL upgrade path.
--
--   2. radar_feed view — replace the hardcoded-zero stub view with a live view
--      that reads from signals + strategic_movements + competitors.
--      The runtime /api/radar-feed endpoint no longer queries this view (it
--      builds the feed directly in TypeScript), but the view is updated here
--      for consistency and for any direct Supabase queries.
--
-- Apply via: Supabase SQL editor (service role) or psql.
-- Safe:      ADD COLUMN IF NOT EXISTS. Backfill uses idempotent UPDATE.
--            DROP/CREATE OR REPLACE for view.
-- =============================================================================

BEGIN;

-- ── 1. Add competitor_id to signals if missing ────────────────────────────────

ALTER TABLE signals
  ADD COLUMN IF NOT EXISTS competitor_id uuid REFERENCES competitors(id) ON DELETE CASCADE;

-- Backfill existing rows from monitored_pages join
UPDATE signals s
  SET competitor_id = mp.competitor_id
  FROM monitored_pages mp
  WHERE mp.id = s.monitored_page_id
    AND s.competitor_id IS NULL;

-- Index for momentum aggregation queries (used by radar-feed handler)
CREATE INDEX IF NOT EXISTS idx_signals_competitor_detected
  ON signals (competitor_id, detected_at DESC)
  WHERE interpreted = true;

-- ── 2. Add (section_diff_id, signal_type) unique constraint on signals ────────
-- Required by detect-signals upsert: onConflict: "section_diff_id,signal_type"
-- Without this constraint, the upsert always inserts (ignoring onConflict),
-- causing duplicate signal rows per diff. Dedupe first to avoid constraint error.

DELETE FROM signals s
WHERE s.id NOT IN (
  SELECT MIN(id)
  FROM signals
  WHERE section_diff_id IS NOT NULL
  GROUP BY section_diff_id, signal_type
)
AND section_diff_id IS NOT NULL;

ALTER TABLE signals
  DROP CONSTRAINT IF EXISTS signals_section_diff_signal_type_unique;

ALTER TABLE signals
  ADD CONSTRAINT signals_section_diff_signal_type_unique
  UNIQUE (section_diff_id, signal_type);

-- ── 3. Replace stub radar_feed view with live aggregation ─────────────────────
-- This view is kept as a reference and for direct Supabase queries.
-- The authoritative radar feed is served by the runtime /api/radar-feed endpoint
-- which builds the feed inline from the same tables (no view dependency).

CREATE OR REPLACE VIEW radar_feed AS
WITH signal_agg AS (
  SELECT
    mp.competitor_id,
    COUNT(*)::integer                                                   AS signals_7d,
    ROUND(
      AVG(CASE s.severity WHEN 'high' THEN 3 WHEN 'medium' THEN 2 ELSE 1 END)::numeric,
      3
    )::numeric(8,3)                                                     AS weighted_velocity_7d,
    MAX(s.detected_at)                                                  AS last_signal_at
  FROM signals s
  JOIN monitored_pages mp ON mp.id = s.monitored_page_id
  WHERE s.interpreted = true
    AND s.detected_at >= now() - interval '7 days'
  GROUP BY mp.competitor_id
),
latest_movement AS (
  SELECT DISTINCT ON (sm.competitor_id)
    sm.competitor_id,
    sm.movement_type,
    sm.confidence,
    sm.signal_count,
    sm.velocity,
    sm.first_seen_at,
    sm.last_seen_at,
    sm.summary
  FROM strategic_movements sm
  WHERE sm.last_seen_at >= now() - interval '14 days'
  ORDER BY sm.competitor_id, sm.last_seen_at DESC
)
SELECT
  c.id                                                                   AS competitor_id,
  c.name                                                                 AS competitor_name,
  c.website_url,
  COALESCE(sa.signals_7d, 0)                                            AS signals_7d,
  COALESCE(sa.weighted_velocity_7d, 0::numeric(8,3))                    AS weighted_velocity_7d,
  COALESCE(c.last_signal_at, sa.last_signal_at)                         AS last_signal_at,
  lm.movement_type                                                       AS latest_movement_type,
  lm.confidence::numeric(4,3)                                            AS latest_movement_confidence,
  lm.signal_count                                                        AS latest_movement_signal_count,
  lm.velocity::numeric(8,3)                                              AS latest_movement_velocity,
  lm.first_seen_at                                                       AS latest_movement_first_seen_at,
  lm.last_seen_at                                                        AS latest_movement_last_seen_at,
  lm.summary                                                             AS latest_movement_summary,
  -- Momentum score: signal density + velocity + movement confidence bonus
  ROUND(
    (
      COALESCE(sa.signals_7d, 0) * 0.4
      + COALESCE(sa.weighted_velocity_7d, 0) * 0.6
      + CASE
          WHEN lm.confidence IS NOT NULL AND lm.last_seen_at >= now() - interval '14 days'
          THEN lm.confidence * 2.5 *
               GREATEST(0, 1 - EXTRACT(EPOCH FROM (now() - lm.last_seen_at)) / (14 * 86400))
          ELSE 0
        END
    )::numeric,
    3
  )::numeric(8,3)                                                        AS momentum_score
FROM competitors c
LEFT JOIN signal_agg sa     ON sa.competitor_id    = c.id
LEFT JOIN latest_movement lm ON lm.competitor_id   = c.id
WHERE c.active = true;

COMMENT ON VIEW radar_feed IS
  'Live radar feed view — aggregates signals + strategic_movements per active competitor. '
  'Authoritative radar data is served by runtime /api/radar-feed (TypeScript, no view dep). '
  'This view is kept for reference and direct Supabase queries. '
  'Replaced stub view from migration 000 (2026-03-15).';

COMMIT;
