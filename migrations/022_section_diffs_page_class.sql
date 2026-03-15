-- =============================================================================
-- Migration: 022_section_diffs_page_class.sql
-- Purpose:   Denormalize page_class onto section_diffs so detect-ambient and
--            detect-signals can filter at the DB layer (index scan) instead of
--            fetching mixed rows and discarding half in TypeScript.
--
-- HOW TO APPLY: paste each block separately in the Supabase SQL editor.
-- All blocks are idempotent (safe to re-run).
-- =============================================================================


-- ============================================================
-- Block 1: Add page_class column + backfill + NOT NULL
-- ============================================================

ALTER TABLE section_diffs
  ADD COLUMN IF NOT EXISTS page_class text;

UPDATE section_diffs sd
SET page_class = mp.page_class
FROM monitored_pages mp
WHERE sd.monitored_page_id = mp.id
  AND sd.page_class IS NULL;

-- Fallback for any orphaned rows with no matching monitored_page.
UPDATE section_diffs
SET page_class = 'standard'
WHERE page_class IS NULL;

ALTER TABLE section_diffs
  ALTER COLUMN page_class SET NOT NULL,
  ALTER COLUMN page_class SET DEFAULT 'standard';


-- ============================================================
-- Block 2: Check constraint on page_class values
-- ============================================================

ALTER TABLE section_diffs
  DROP CONSTRAINT IF EXISTS chk_section_diffs_page_class;

ALTER TABLE section_diffs
  ADD CONSTRAINT chk_section_diffs_page_class
  CHECK (page_class IN ('high_value', 'standard', 'ambient'));


-- ============================================================
-- Block 3: Partial index for detect-ambient-activity
-- ============================================================
-- Covers only ambient pending diffs. detect-ambient fetches
-- exclusively from this set. No overlap with detect-signals.

CREATE INDEX IF NOT EXISTS idx_section_diffs_ambient_pending
  ON section_diffs (last_seen_at ASC)
  WHERE confirmed = true
    AND signal_detected = false
    AND is_noise = false
    AND page_class = 'ambient';


-- ============================================================
-- Block 4: Partial index for detect-signals
-- ============================================================
-- Covers only non-ambient pending diffs. detect-signals fetches
-- exclusively from this set. No overlap with detect-ambient.

CREATE INDEX IF NOT EXISTS idx_section_diffs_non_ambient_pending
  ON section_diffs (last_seen_at ASC)
  WHERE confirmed = true
    AND signal_detected = false
    AND is_noise = false
    AND page_class <> 'ambient';
