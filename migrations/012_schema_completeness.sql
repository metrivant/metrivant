-- =============================================================================
-- Migration: 012_schema_completeness.sql
-- Purpose:   Complete the schema to cover all pipeline behaviors and UI needs.
--
--   1. signals — add `suppressed_at` and `suppressed_reason` for audit trail
--      when confidence gating silently discards a diff
--   2. signals — add `interpreter_confidence` to distinguish OpenAI's returned
--      confidence from our pre-interpretation confidence_score
--   3. section_diffs — add `diff_size_bytes` for extraction health monitoring
--   4. monitored_pages — add `last_fetched_at` for staleness detection in UI
--   5. monitored_pages — add `consecutive_fetch_failures` to auto-deactivate
--      pages that return 404/timeout consistently (data hygiene)
--   6. competitors — add `last_signal_at` denormalized field for fast UI sort
--      (avoids a JOIN to signals on every dashboard load)
--   7. interpretations — ensure `prompt_hash` column exists for version gating
--   8. Trigger to keep competitors.last_signal_at up to date automatically
--
-- Apply via: Supabase SQL editor (service role) or psql.
-- Safe:      ADD COLUMN IF NOT EXISTS throughout. Trigger uses CREATE OR REPLACE.
-- =============================================================================

BEGIN;

-- ── 1. signals: audit columns for suppressed signals ─────────────────────────

ALTER TABLE signals
  ADD COLUMN IF NOT EXISTS suppressed_at     timestamptz,
  ADD COLUMN IF NOT EXISTS suppressed_reason text;

-- ── 2. signals: separate OpenAI confidence from pre-interpretation score ──────
-- confidence_score = computed by detect-signals from section weight + recency
-- interpreter_confidence = returned by OpenAI in interpretation result JSON

ALTER TABLE signals
  ADD COLUMN IF NOT EXISTS interpreter_confidence float;

-- ── 3. section_diffs: change magnitude tracking ───────────────────────────────
-- Allows filtering/sorting on how large a diff was (bytes changed).
-- Populated by detect-diffs; useful for noise triage.

ALTER TABLE section_diffs
  ADD COLUMN IF NOT EXISTS diff_size_bytes integer;

-- ── 4. monitored_pages: fetch tracking for UI staleness indicator ─────────────

ALTER TABLE monitored_pages
  ADD COLUMN IF NOT EXISTS last_fetched_at              timestamptz,
  ADD COLUMN IF NOT EXISTS consecutive_fetch_failures   integer NOT NULL DEFAULT 0;

-- Auto-deactivate pages with >= 5 consecutive fetch failures.
-- The fetch-snapshots handler should increment this on failure and
-- reset it on success. This trigger enforces the deactivation rule.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_deactivate_failing_pages'
  ) THEN
    CREATE OR REPLACE FUNCTION deactivate_failing_pages()
    RETURNS trigger AS $fn$
    BEGIN
      IF NEW.consecutive_fetch_failures >= 5 THEN
        NEW.active := false;
      END IF;
      RETURN NEW;
    END;
    $fn$ LANGUAGE plpgsql;

    CREATE TRIGGER trg_deactivate_failing_pages
      BEFORE UPDATE OF consecutive_fetch_failures ON monitored_pages
      FOR EACH ROW
      EXECUTE FUNCTION deactivate_failing_pages();
  END IF;
END$$;

-- ── 5. competitors: denormalized last_signal_at ───────────────────────────────
-- Avoids a MAX(detected_at) JOIN on every radar feed load.
-- Kept in sync by the trigger below.

ALTER TABLE competitors
  ADD COLUMN IF NOT EXISTS last_signal_at timestamptz;

-- Backfill from existing signals
UPDATE competitors c
  SET last_signal_at = (
    SELECT MAX(s.detected_at)
    FROM signals s
    JOIN monitored_pages mp ON mp.id = s.monitored_page_id
    WHERE mp.competitor_id = c.id
      AND s.interpreted = true
  )
  WHERE last_signal_at IS NULL;

-- Trigger to keep last_signal_at current whenever a signal is interpreted
CREATE OR REPLACE FUNCTION sync_competitor_last_signal_at()
RETURNS trigger AS $$
BEGIN
  -- Only fire when a signal transitions to 'interpreted'
  IF NEW.interpreted = true AND (OLD.interpreted = false OR OLD.interpreted IS NULL) THEN
    UPDATE competitors c
      SET last_signal_at = GREATEST(c.last_signal_at, NEW.detected_at)
      FROM monitored_pages mp
      WHERE mp.id = NEW.monitored_page_id
        AND c.id  = mp.competitor_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_sync_last_signal_at'
  ) THEN
    CREATE TRIGGER trg_sync_last_signal_at
      AFTER UPDATE OF interpreted ON signals
      FOR EACH ROW
      EXECUTE FUNCTION sync_competitor_last_signal_at();
  END IF;
END$$;

-- ── 6. interpretations: ensure prompt_hash column exists ─────────────────────
-- Referenced by the prompt-version re-queue logic in interpret-signals handler.

ALTER TABLE interpretations
  ADD COLUMN IF NOT EXISTS prompt_hash text;

-- ── 7. Support index for competitor last_signal_at ordering ──────────────────

CREATE INDEX IF NOT EXISTS idx_competitors_last_signal
  ON competitors (last_signal_at DESC NULLS LAST)
  WHERE active = true;

-- ── 8. Support index for monitored_pages staleness detection ─────────────────

CREATE INDEX IF NOT EXISTS idx_monitored_pages_last_fetched
  ON monitored_pages (page_class, last_fetched_at DESC NULLS LAST)
  WHERE active = true;

COMMIT;
