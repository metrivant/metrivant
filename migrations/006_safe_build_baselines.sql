-- =============================================================================
-- Migration: 006_safe_build_baselines.sql
-- Purpose:   Replace build_section_baselines() with a version that ONLY
--            inserts baselines where none exists yet. It never updates an
--            existing baseline.
--
-- Root cause fixed: if the previous RPC updated baselines on every cron run,
-- detect-diffs always saw current_hash == baseline_hash → no diffs → no signals.
--
-- Correct behavior: baseline = the FIRST valid section observed for a
-- (monitored_page_id, section_type) pair. It never changes. The diff is always
-- computed against the original state. This is what enables change detection.
--
-- Apply via: Supabase SQL editor (service role) or psql.
-- Safe:      CREATE OR REPLACE — no schema changes, no data loss.
-- =============================================================================

CREATE OR REPLACE FUNCTION build_section_baselines()
RETURNS integer AS $$
DECLARE
  inserted_count integer;
BEGIN
  -- Insert a baseline only when none exists for this (page, section_type) pair.
  -- Uses the OLDEST valid section as the baseline anchor (ASCENDING created_at).
  -- Subsequent calls are idempotent — existing baselines are never modified.
  INSERT INTO section_baselines (
    monitored_page_id,
    section_type,
    section_hash,
    source_section_id
  )
  SELECT DISTINCT ON (ps.monitored_page_id, ps.section_type)
    ps.monitored_page_id,
    ps.section_type,
    ps.section_hash,
    ps.id AS source_section_id
  FROM page_sections ps
  WHERE
    ps.validation_status = 'valid'
    AND ps.section_text IS NOT NULL
    AND ps.section_text <> ''
    AND NOT EXISTS (
      SELECT 1
      FROM section_baselines sb
      WHERE
        sb.monitored_page_id = ps.monitored_page_id
        AND sb.section_type   = ps.section_type
    )
  ORDER BY ps.monitored_page_id, ps.section_type, ps.created_at ASC;

  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  RETURN inserted_count;
END;
$$ LANGUAGE plpgsql;
