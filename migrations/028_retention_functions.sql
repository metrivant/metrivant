-- =============================================================================
-- Migration: 028_retention_functions.sql
-- Purpose:   Four idempotent retention functions called by /api/retention cron.
--            Each function is independent — failure in one does not affect others.
--
-- Policy:
--   RAW_HTML           7 days  — null, not delete
--   EXTRACTED_SECTIONS 90 days — delete, skip rows referenced by baselines/diffs
--   DIFFS              180 days — delete, skip rows referenced by signals
--   PIPELINE_EVENTS    90 days — delete unconditionally
--
-- Never deletes: signals, interpretations, signal_feedback, section_baselines
-- =============================================================================


-- ── Tier 1: NULL raw HTML on processed snapshots ─────────────────────────────
-- Only snapshots with sections_extracted=true are eligible — unprocessed
-- snapshots may still be in the extract-sections queue.
-- raw_html IS NOT NULL guard prevents unnecessary UPDATE churning on rows
-- already cleaned by a previous run (idempotent).

CREATE OR REPLACE FUNCTION retention_null_raw_html(cutoff_days integer DEFAULT 7)
RETURNS integer AS $func$
DECLARE
  affected integer;
BEGIN
  UPDATE snapshots
  SET    raw_html = NULL
  WHERE  sections_extracted = true
    AND  fetched_at < now() - (cutoff_days || ' days')::interval
    AND  raw_html IS NOT NULL;

  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$func$ LANGUAGE plpgsql;


-- ── Tier 2: Delete old page_sections ─────────────────────────────────────────
-- FK safety guards:
--   section_baselines.source_section_id → page_sections.id
--   section_diffs.previous_section_id   → page_sections.id
--   section_diffs.current_section_id    → page_sections.id
-- Any section still anchoring a baseline or referenced by an open diff is skipped.

CREATE OR REPLACE FUNCTION retention_delete_sections(cutoff_days integer DEFAULT 90)
RETURNS integer AS $func$
DECLARE
  deleted integer;
BEGIN
  DELETE FROM page_sections ps
  WHERE  ps.created_at < now() - (cutoff_days || ' days')::interval
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
  RETURN deleted;
END;
$func$ LANGUAGE plpgsql;


-- ── Tier 3: Delete old section_diffs ─────────────────────────────────────────
-- FK safety guard:
--   signals.section_diff_id → section_diffs.id
-- A diff still referenced by a signal is skipped.
-- signal_detected = true guard ensures only fully-processed diffs are eligible;
-- diffs still in the detection pipeline are never touched.

CREATE OR REPLACE FUNCTION retention_delete_diffs(cutoff_days integer DEFAULT 180)
RETURNS integer AS $func$
DECLARE
  deleted integer;
BEGIN
  DELETE FROM section_diffs sd
  WHERE  sd.signal_detected = true
    AND  sd.last_seen_at < now() - (cutoff_days || ' days')::interval
    AND  NOT EXISTS (
           SELECT 1 FROM signals sig
           WHERE  sig.section_diff_id = sd.id
         );

  GET DIAGNOSTICS deleted = ROW_COUNT;
  RETURN deleted;
END;
$func$ LANGUAGE plpgsql;


-- ── Tier 4: Delete old pipeline_events ───────────────────────────────────────
-- pipeline_events is pure telemetry. No FK references to retained tables.
-- Safe to delete unconditionally beyond the retention window.

CREATE OR REPLACE FUNCTION retention_delete_pipeline_events(cutoff_days integer DEFAULT 90)
RETURNS integer AS $func$
DECLARE
  deleted integer;
BEGIN
  DELETE FROM pipeline_events
  WHERE  created_at < now() - (cutoff_days || ' days')::interval;

  GET DIAGNOSTICS deleted = ROW_COUNT;
  RETURN deleted;
END;
$func$ LANGUAGE plpgsql;
