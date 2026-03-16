-- =============================================================================
-- sql/retention-cleanup.sql
-- Manual retention cleanup — run each block independently in the Supabase
-- SQL editor. Each block is wrapped in an independent DO/BEGIN/EXCEPTION so
-- one failure does not prevent the others from running.
--
-- Retention policy (mirrors lib/retention-config.ts):
--   RAW_HTML            7 days  — null, not row-deleted
--   EXTRACTED_SECTIONS  90 days — delete rows, skip referenced rows
--   DIFFS              180 days — delete rows, skip rows referenced by signals
--   PIPELINE_EVENTS     90 days — delete rows unconditionally
--
-- Never deletes: signals, interpretations, signal_feedback, section_baselines
-- =============================================================================


-- ── DRY-RUN ESTIMATION ────────────────────────────────────────────────────────
-- Run these read-only queries first to estimate volume before any cleanup.


-- Tier 1 estimate: raw HTML rows eligible for nulling
SELECT
  COUNT(*) AS snapshots_to_null,
  pg_size_pretty(SUM(length(raw_html::text))) AS estimated_html_space_freed
FROM snapshots
WHERE sections_extracted = true
  AND fetched_at < now() - interval '7 days'
  AND raw_html IS NOT NULL;

-- Tier 2 estimate: old page_sections eligible for deletion
SELECT COUNT(*) AS sections_to_delete
FROM page_sections ps
WHERE ps.created_at < now() - interval '90 days'
  AND NOT EXISTS (
        SELECT 1 FROM section_baselines sb WHERE sb.source_section_id = ps.id
      )
  AND NOT EXISTS (
        SELECT 1 FROM section_diffs sd
        WHERE sd.previous_section_id = ps.id OR sd.current_section_id = ps.id
      );

-- Tier 3 estimate: old section_diffs eligible for deletion
SELECT COUNT(*) AS diffs_to_delete
FROM section_diffs sd
WHERE sd.signal_detected = true
  AND sd.last_seen_at < now() - interval '180 days'
  AND NOT EXISTS (
        SELECT 1 FROM signals sig WHERE sig.section_diff_id = sd.id
      );

-- Tier 3 estimate: diffs ineligible because still referenced by signals
SELECT COUNT(*) AS diffs_skipped_referenced
FROM section_diffs sd
WHERE sd.signal_detected = true
  AND sd.last_seen_at < now() - interval '180 days'
  AND EXISTS (
        SELECT 1 FROM signals sig WHERE sig.section_diff_id = sd.id
      );

-- Tier 4 estimate: pipeline_events eligible for deletion
SELECT COUNT(*) AS events_to_delete
FROM pipeline_events
WHERE created_at < now() - interval '90 days';


-- ═══════════════════════════════════════════════════════════════════════════════
-- LIVE CLEANUP — run each block separately after reviewing dry-run estimates
-- ═══════════════════════════════════════════════════════════════════════════════


-- ── Tier 1: NULL raw HTML (7-day retention) ───────────────────────────────────
-- Nulls raw_html on fully-processed snapshots older than 7 days.
-- Does NOT delete rows — snapshot metadata is retained.
-- sections_extracted = true guard prevents clearing unprocessed snapshots.

DO $$
DECLARE
  affected integer;
BEGIN
  UPDATE snapshots
  SET    raw_html = NULL
  WHERE  sections_extracted = true
    AND  fetched_at < now() - interval '7 days'
    AND  raw_html IS NOT NULL;

  GET DIAGNOSTICS affected = ROW_COUNT;
  RAISE NOTICE 'Tier 1 (raw HTML nulled): % rows', affected;

EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Tier 1 failed: %', SQLERRM;
END;
$$;


-- ── Tier 2: Delete old extracted sections (90-day retention) ─────────────────
-- Deletes page_sections rows beyond the retention window.
-- FK safety: skips any row still referenced by section_baselines or section_diffs.
--   section_baselines.source_section_id → page_sections.id
--   section_diffs.previous_section_id   → page_sections.id
--   section_diffs.current_section_id    → page_sections.id

DO $$
DECLARE
  deleted integer;
BEGIN
  DELETE FROM page_sections ps
  WHERE  ps.created_at < now() - interval '90 days'
    AND  NOT EXISTS (
           SELECT 1 FROM section_baselines sb
           WHERE  sb.source_section_id = ps.id
         )
    AND  NOT EXISTS (
           SELECT 1 FROM section_diffs sd
           WHERE  sd.previous_section_id = ps.id
              OR  sd.current_section_id  = ps.id
         );

  GET DIAGNOSTICS deleted = ROW_COUNT;
  RAISE NOTICE 'Tier 2 (sections deleted): % rows', deleted;

EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Tier 2 failed: %', SQLERRM;
END;
$$;


-- ── Tier 3: Delete old section_diffs (180-day retention) ─────────────────────
-- Deletes processed section_diffs beyond the retention window.
-- FK safety: skips any diff still referenced by a signal row.
--   signals.section_diff_id → section_diffs.id
-- signal_detected = true guard: only fully-processed diffs are eligible.
-- Diffs still in the pipeline (signal_detected = false) are never touched.

DO $$
DECLARE
  deleted integer;
BEGIN
  DELETE FROM section_diffs sd
  WHERE  sd.signal_detected = true
    AND  sd.last_seen_at < now() - interval '180 days'
    AND  NOT EXISTS (
           SELECT 1 FROM signals sig
           WHERE  sig.section_diff_id = sd.id
         );

  GET DIAGNOSTICS deleted = ROW_COUNT;
  RAISE NOTICE 'Tier 3 (diffs deleted): % rows', deleted;

EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Tier 3 failed: %', SQLERRM;
END;
$$;


-- ── Tier 4: Delete old pipeline_events (90-day retention) ────────────────────
-- pipeline_events is pure telemetry. No FK references to retained tables.
-- Safe to delete beyond the retention window without reference checks.

DO $$
DECLARE
  deleted integer;
BEGIN
  DELETE FROM pipeline_events
  WHERE  created_at < now() - interval '90 days';

  GET DIAGNOSTICS deleted = ROW_COUNT;
  RAISE NOTICE 'Tier 4 (pipeline_events deleted): % rows', deleted;

EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Tier 4 failed: %', SQLERRM;
END;
$$;
