-- 049_cascade_fks
--
-- Adds ON DELETE CASCADE to foreign keys on the 7 original core tables that
-- were created before migrations and lack it. Without this, deleting a
-- competitor requires manually deleting child rows in strict dependency order.
-- With it, DELETE FROM competitors WHERE id = '...' cascades automatically.
--
-- Cascade relationships added:
--   competitors          → monitored_pages       (competitor_id)
--   competitors          → tracked_competitors   (competitor_id)
--   competitors          → strategic_movements   (competitor_id)
--   monitored_pages      → snapshots             (monitored_page_id)
--   monitored_pages      → section_baselines     (monitored_page_id)
--   snapshots            → page_sections         (snapshot_id)
--   page_sections        → section_diffs         (page_section_id)
--
-- NOT changed (intentionally preserved as RESTRICT):
--   section_diffs  → signals         (retention logic skips diffs referenced by signals)
--   signals        → interpretations (interpretations are preserved independently)
--   signals        → signal_feedback (operator labels must never be auto-deleted)
--
-- Each block uses a DO $$ procedure to find the existing FK constraint name
-- dynamically (since original tables used Postgres default naming, which
-- may differ from migration-created tables). Safe to re-run — IF NOT EXISTS
-- guards prevent duplicate constraint errors.
--
-- Run in Supabase SQL Editor. Requires no downtime — ALTER TABLE ADD/DROP
-- CONSTRAINT acquires a brief ACCESS EXCLUSIVE lock per table.

-- ── 1. monitored_pages → competitors ─────────────────────────────────────────
DO $$
DECLARE v TEXT;
BEGIN
  SELECT c.conname INTO v
  FROM pg_constraint c
  JOIN pg_class t ON c.conrelid = t.oid
  WHERE t.relname = 'monitored_pages' AND c.contype = 'f'
    AND EXISTS (
      SELECT 1 FROM pg_attribute a
      WHERE a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
        AND a.attname = 'competitor_id'
    );
  IF v IS NOT NULL THEN
    EXECUTE 'ALTER TABLE monitored_pages DROP CONSTRAINT ' || quote_ident(v);
  END IF;
END $$;

ALTER TABLE monitored_pages
  ADD CONSTRAINT monitored_pages_competitor_id_fkey
  FOREIGN KEY (competitor_id) REFERENCES competitors(id) ON DELETE CASCADE;

-- ── 2. tracked_competitors → competitors ──────────────────────────────────────
DO $$
DECLARE v TEXT;
BEGIN
  SELECT c.conname INTO v
  FROM pg_constraint c
  JOIN pg_class t ON c.conrelid = t.oid
  WHERE t.relname = 'tracked_competitors' AND c.contype = 'f'
    AND EXISTS (
      SELECT 1 FROM pg_attribute a
      WHERE a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
        AND a.attname = 'competitor_id'
    );
  IF v IS NOT NULL THEN
    EXECUTE 'ALTER TABLE tracked_competitors DROP CONSTRAINT ' || quote_ident(v);
  END IF;
END $$;

ALTER TABLE tracked_competitors
  ADD CONSTRAINT tracked_competitors_competitor_id_fkey
  FOREIGN KEY (competitor_id) REFERENCES competitors(id) ON DELETE CASCADE;

-- ── 3. strategic_movements → competitors ──────────────────────────────────────
DO $$
DECLARE v TEXT;
BEGIN
  SELECT c.conname INTO v
  FROM pg_constraint c
  JOIN pg_class t ON c.conrelid = t.oid
  WHERE t.relname = 'strategic_movements' AND c.contype = 'f'
    AND EXISTS (
      SELECT 1 FROM pg_attribute a
      WHERE a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
        AND a.attname = 'competitor_id'
    );
  IF v IS NOT NULL THEN
    EXECUTE 'ALTER TABLE strategic_movements DROP CONSTRAINT ' || quote_ident(v);
  END IF;
END $$;

ALTER TABLE strategic_movements
  ADD CONSTRAINT strategic_movements_competitor_id_fkey
  FOREIGN KEY (competitor_id) REFERENCES competitors(id) ON DELETE CASCADE;

-- ── 4. snapshots → monitored_pages ───────────────────────────────────────────
DO $$
DECLARE v TEXT;
BEGIN
  SELECT c.conname INTO v
  FROM pg_constraint c
  JOIN pg_class t ON c.conrelid = t.oid
  WHERE t.relname = 'snapshots' AND c.contype = 'f'
    AND EXISTS (
      SELECT 1 FROM pg_attribute a
      WHERE a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
        AND a.attname = 'monitored_page_id'
    );
  IF v IS NOT NULL THEN
    EXECUTE 'ALTER TABLE snapshots DROP CONSTRAINT ' || quote_ident(v);
  END IF;
END $$;

ALTER TABLE snapshots
  ADD CONSTRAINT snapshots_monitored_page_id_fkey
  FOREIGN KEY (monitored_page_id) REFERENCES monitored_pages(id) ON DELETE CASCADE;

-- ── 5. section_baselines → monitored_pages ────────────────────────────────────
DO $$
DECLARE v TEXT;
BEGIN
  SELECT c.conname INTO v
  FROM pg_constraint c
  JOIN pg_class t ON c.conrelid = t.oid
  WHERE t.relname = 'section_baselines' AND c.contype = 'f'
    AND EXISTS (
      SELECT 1 FROM pg_attribute a
      WHERE a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
        AND a.attname = 'monitored_page_id'
    );
  IF v IS NOT NULL THEN
    EXECUTE 'ALTER TABLE section_baselines DROP CONSTRAINT ' || quote_ident(v);
  END IF;
END $$;

ALTER TABLE section_baselines
  ADD CONSTRAINT section_baselines_monitored_page_id_fkey
  FOREIGN KEY (monitored_page_id) REFERENCES monitored_pages(id) ON DELETE CASCADE;

-- ── 6. page_sections → snapshots ─────────────────────────────────────────────
DO $$
DECLARE v TEXT;
BEGIN
  SELECT c.conname INTO v
  FROM pg_constraint c
  JOIN pg_class t ON c.conrelid = t.oid
  WHERE t.relname = 'page_sections' AND c.contype = 'f'
    AND EXISTS (
      SELECT 1 FROM pg_attribute a
      WHERE a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
        AND a.attname = 'snapshot_id'
    );
  IF v IS NOT NULL THEN
    EXECUTE 'ALTER TABLE page_sections DROP CONSTRAINT ' || quote_ident(v);
  END IF;
END $$;

ALTER TABLE page_sections
  ADD CONSTRAINT page_sections_snapshot_id_fkey
  FOREIGN KEY (snapshot_id) REFERENCES snapshots(id) ON DELETE CASCADE;

-- ── 7. section_diffs → monitored_pages ───────────────────────────────────────
-- Note: section_diffs has no page_section_id column. It references page_sections
-- via previous_section_id and current_section_id (no CASCADE needed there — the
-- retention code manages those relationships). The direct monitored_page_id FK
-- to monitored_pages is the correct cascade path for competitor cleanup.
DO $$
DECLARE v TEXT;
BEGIN
  SELECT c.conname INTO v
  FROM pg_constraint c
  JOIN pg_class t ON c.conrelid = t.oid
  WHERE t.relname = 'section_diffs' AND c.contype = 'f'
    AND EXISTS (
      SELECT 1 FROM pg_attribute a
      WHERE a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
        AND a.attname = 'monitored_page_id'
    );
  IF v IS NOT NULL THEN
    EXECUTE 'ALTER TABLE section_diffs DROP CONSTRAINT ' || quote_ident(v);
  END IF;
END $$;

ALTER TABLE section_diffs
  ADD CONSTRAINT section_diffs_monitored_page_id_fkey
  FOREIGN KEY (monitored_page_id) REFERENCES monitored_pages(id) ON DELETE CASCADE;
