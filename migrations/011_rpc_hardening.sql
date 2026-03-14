-- =============================================================================
-- Migration: 011_rpc_hardening.sql
-- Purpose:   Harden and extend the RPC layer used by the interpret-signals
--            and signal lifecycle management handlers.
--
--   1. claim_pending_signals   — atomic claim with FOR UPDATE SKIP LOCKED to
--                                prevent double-processing on concurrent runs
--   2. reset_stuck_signals     — idempotent reset with precise staleness window
--   3. fail_exhausted_signals  — deterministic failure gate at retry limit
--   4. prune_activity_events   — bounded 30-day retention cleanup
--   5. get_competitor_summary  — convenience RPC for UI: returns competitor with
--                                latest signal count and pressure_index in one query
--
-- Apply via: Supabase SQL editor (service role) or psql.
-- Safe:      All functions use CREATE OR REPLACE — no data changes on apply.
-- =============================================================================

-- ── 1. claim_pending_signals ─────────────────────────────────────────────────
-- Atomically claims up to `batch_size` pending signals for interpretation.
-- Uses FOR UPDATE SKIP LOCKED to prevent concurrent cron runs from claiming
-- the same signals. Returns the claimed rows (id, signal_type, retry_count).

CREATE OR REPLACE FUNCTION claim_pending_signals(batch_size integer DEFAULT 5)
RETURNS TABLE(id uuid, signal_type text, retry_count integer) AS $$
BEGIN
  RETURN QUERY
  UPDATE signals s
  SET
    status     = 'in_progress',
    updated_at = now()
  FROM (
    SELECT s2.id
    FROM signals s2
    WHERE
      s2.status      = 'pending'
      AND s2.interpreted = false
    ORDER BY s2.detected_at ASC
    LIMIT batch_size
    FOR UPDATE SKIP LOCKED
  ) claimed
  WHERE s.id = claimed.id
  RETURNING s.id, s.signal_type, s.retry_count;
END;
$$ LANGUAGE plpgsql;

-- ── 2. reset_stuck_signals ───────────────────────────────────────────────────
-- Resets signals that entered 'in_progress' but were never completed.
-- Caller passes stale_minutes (default 30) to match the interpret-signals handler.

CREATE OR REPLACE FUNCTION reset_stuck_signals(stale_minutes integer DEFAULT 30)
RETURNS integer AS $$
DECLARE
  reset_count integer;
BEGIN
  UPDATE signals
  SET
    status     = 'pending',
    updated_at = now()
  WHERE
    status     = 'in_progress'
    AND updated_at < now() - (stale_minutes || ' minutes')::interval;

  GET DIAGNOSTICS reset_count = ROW_COUNT;
  RETURN reset_count;
END;
$$ LANGUAGE plpgsql;

-- ── 3. fail_exhausted_signals ────────────────────────────────────────────────
-- Permanently fails signals that have exceeded the maximum retry count.
-- Prevents infinite retry loops for signals with bad data.

CREATE OR REPLACE FUNCTION fail_exhausted_signals(max_retries integer DEFAULT 5)
RETURNS integer AS $$
DECLARE
  fail_count integer;
BEGIN
  UPDATE signals
  SET
    status     = 'failed',
    updated_at = now()
  WHERE
    status      IN ('pending', 'in_progress')
    AND retry_count >= max_retries;

  GET DIAGNOSTICS fail_count = ROW_COUNT;
  RETURN fail_count;
END;
$$ LANGUAGE plpgsql;

-- ── 4. prune_activity_events ─────────────────────────────────────────────────
-- Deletes activity_events older than `retain_days` (default 30).
-- Called inline in detect-ambient-activity handler each run.
-- Can also be scheduled via Supabase pg_cron.

CREATE OR REPLACE FUNCTION prune_activity_events(retain_days integer DEFAULT 30)
RETURNS integer AS $$
DECLARE
  pruned_count integer;
BEGIN
  DELETE FROM activity_events
    WHERE detected_at < now() - (retain_days || ' days')::interval;

  GET DIAGNOSTICS pruned_count = ROW_COUNT;
  RETURN pruned_count;
END;
$$ LANGUAGE plpgsql;

-- ── 5. prune_old_page_sections ───────────────────────────────────────────────
-- Deletes page_sections extracted from snapshots older than `retain_days` (90d),
-- EXCEPT for sections that are referenced as source_section_id in section_baselines
-- (these are the anchor points and must be preserved indefinitely).

CREATE OR REPLACE FUNCTION prune_old_page_sections(retain_days integer DEFAULT 90)
RETURNS integer AS $$
DECLARE
  pruned_count integer;
BEGIN
  DELETE FROM page_sections ps
  WHERE
    ps.created_at < now() - (retain_days || ' days')::interval
    AND NOT EXISTS (
      SELECT 1 FROM section_baselines sb
      WHERE sb.source_section_id = ps.id
    )
    AND NOT EXISTS (
      SELECT 1 FROM section_diffs sd
      WHERE sd.previous_section_id = ps.id OR sd.current_section_id = ps.id
    );

  GET DIAGNOSTICS pruned_count = ROW_COUNT;
  RETURN pruned_count;
END;
$$ LANGUAGE plpgsql;

-- ── 6. get_competitor_pressure_summary ───────────────────────────────────────
-- Returns a quick summary row per competitor for the UI radar node labels:
-- pressure_index, recent_signal_count (7d), recent_activity_count (48h).

CREATE OR REPLACE FUNCTION get_competitor_pressure_summary()
RETURNS TABLE(
  competitor_id       uuid,
  pressure_index      float,
  signal_count_7d     bigint,
  activity_count_48h  bigint
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id AS competitor_id,
    c.pressure_index,
    COALESCE(s.cnt, 0)  AS signal_count_7d,
    COALESCE(ae.cnt, 0) AS activity_count_48h
  FROM competitors c
  LEFT JOIN (
    SELECT mp.competitor_id, COUNT(*) AS cnt
    FROM signals sig
    JOIN monitored_pages mp ON mp.id = sig.monitored_page_id
    WHERE sig.detected_at >= now() - interval '7 days'
      AND sig.interpreted = true
    GROUP BY mp.competitor_id
  ) s ON s.competitor_id = c.id
  LEFT JOIN (
    SELECT ae.competitor_id, COUNT(*) AS cnt
    FROM activity_events ae
    WHERE ae.detected_at >= now() - interval '48 hours'
    GROUP BY ae.competitor_id
  ) ae ON ae.competitor_id = c.id
  WHERE c.active = true
  ORDER BY c.pressure_index DESC;
END;
$$ LANGUAGE plpgsql;
