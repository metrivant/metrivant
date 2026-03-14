-- =============================================================================
-- Migration: 010_data_integrity.sql
-- Purpose:   Enforce data integrity across the pipeline with:
--
--   1. CHECK constraints on status enum columns to prevent invalid values
--   2. Backfill confidence_score for existing signals (uses 0.5 default to
--      avoid suppressing established signals retroactively)
--   3. Orphan cleanup — remove signals/diffs pointing to deleted pages
--   4. Stale in-progress signal reset — prevent permanent stuck state
--   5. Noise column on section_diffs — ensure noise_reason column exists
--      (referenced by detect-signals precision tuning pass)
--   6. Index on section_diffs (is_noise) to support noise audit queries
--   7. Prune oversized snapshots table — delete raw_html from snapshots
--      older than 60 days where extraction is complete (saves storage)
--
-- Apply via: Supabase SQL editor (service role) or psql.
-- Safe:      All constraint additions are guarded by existence checks.
--            Destructive operations (prune) are bounded and reversible via
--            the source URL if re-fetching is required.
-- =============================================================================

BEGIN;

-- ── 1. Ensure noise_reason column exists on section_diffs ────────────────────
-- detect-signals whitespace check sets is_noise=true, noise_reason='whitespace_only'
-- These columns should exist from schema init; this guards against older deploys.

ALTER TABLE section_diffs
  ADD COLUMN IF NOT EXISTS is_noise     boolean  NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS noise_reason text;

-- ── 2. CHECK constraints on status enum columns ───────────────────────────────

-- signals.status
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'signals_status_check'
  ) THEN
    ALTER TABLE signals
      ADD CONSTRAINT signals_status_check
        CHECK (status IN ('pending', 'pending_review', 'in_progress', 'interpreted', 'failed'));
  END IF;
END$$;

-- section_diffs.status
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'section_diffs_status_check'
  ) THEN
    ALTER TABLE section_diffs
      ADD CONSTRAINT section_diffs_status_check
        CHECK (status IN ('unconfirmed', 'confirmed', 'noise'));
  END IF;
END$$;

-- monitored_pages.page_class (also in migration 008, safe to repeat)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'monitored_pages_page_class_check'
  ) THEN
    ALTER TABLE monitored_pages
      ADD CONSTRAINT monitored_pages_page_class_check
        CHECK (page_class IN ('high_value', 'standard', 'ambient'));
  END IF;
END$$;

-- ── 3. Backfill confidence_score for existing signals ─────────────────────────
-- Existing signals have NULL confidence_score because they pre-date migration 008.
-- Set to 0.5 (neutral) so they remain eligible for movement grouping but don't
-- artificially inflate confidence of the movements they belong to.
-- Uses a conservative value — does NOT retroactively suppress any existing signal.

UPDATE signals
  SET confidence_score = 0.5
  WHERE confidence_score IS NULL;

-- ── 4. Orphan signal cleanup ──────────────────────────────────────────────────
-- Remove signals whose monitored_page was hard-deleted (FK would have caught
-- this with ON DELETE CASCADE, but this repairs any pre-constraint rows).

DELETE FROM signals s
  WHERE NOT EXISTS (
    SELECT 1 FROM monitored_pages mp WHERE mp.id = s.monitored_page_id
  );

-- Remove section_diffs whose monitored_page was hard-deleted
DELETE FROM section_diffs sd
  WHERE NOT EXISTS (
    SELECT 1 FROM monitored_pages mp WHERE mp.id = sd.monitored_page_id
  );

-- ── 5. Reset permanently-stuck in_progress signals ───────────────────────────
-- Signals that entered 'in_progress' more than 2 hours ago and never completed.
-- The interpret-signals handler calls reset_stuck_signals RPC each run, but this
-- handles any backlog that accumulated before the RPC existed.

UPDATE signals
  SET
    status      = 'pending',
    retry_count = LEAST(retry_count + 1, 5),
    last_error  = 'reset_by_migration_010'
  WHERE
    status = 'in_progress'
    AND updated_at < now() - interval '2 hours';

-- ── 6. Retire diffs for inactive pages ───────────────────────────────────────
-- section_diffs accumulate indefinitely for pages that were deactivated.
-- Mark them as signal_detected=true so they don't re-enter the pipeline.

UPDATE section_diffs sd
  SET signal_detected = true
  FROM monitored_pages mp
  WHERE
    sd.monitored_page_id = mp.id
    AND mp.active = false
    AND sd.signal_detected = false;

-- ── 7. Clean up duplicate section_diffs ──────────────────────────────────────
-- Guard against any race-condition duplicates that slipped through before the
-- ON CONFLICT guard was added in migration 004. Keep the most recent row per
-- (monitored_page_id, section_type, previous_section_id).

DELETE FROM section_diffs sd
  USING (
    SELECT
      monitored_page_id,
      section_type,
      previous_section_id,
      MAX(last_seen_at) AS keep_last_seen_at
    FROM section_diffs
    WHERE previous_section_id IS NOT NULL
    GROUP BY monitored_page_id, section_type, previous_section_id
    HAVING COUNT(*) > 1
  ) dupes
  WHERE
    sd.monitored_page_id   = dupes.monitored_page_id
    AND sd.section_type    = dupes.section_type
    AND sd.previous_section_id = dupes.previous_section_id
    AND sd.last_seen_at    < dupes.keep_last_seen_at;

-- ── 8. Noise audit index ──────────────────────────────────────────────────────
-- Supports queries like "how many whitespace-only diffs have we suppressed this week?"

CREATE INDEX IF NOT EXISTS idx_section_diffs_noise
  ON section_diffs (noise_reason, last_seen_at DESC)
  WHERE is_noise = true;

-- ── 9. Compact old snapshots — free raw_html storage ─────────────────────────
-- Snapshots older than 60 days that are fully extracted are no longer needed
-- for the pipeline. Set raw_html to '' to reclaim storage while preserving
-- the row for audit/lineage purposes. The URL is still in monitored_pages.

UPDATE snapshots
  SET raw_html = ''
  WHERE
    sections_extracted = true
    AND fetched_at < now() - interval '60 days'
    AND raw_html <> '';

COMMIT;
