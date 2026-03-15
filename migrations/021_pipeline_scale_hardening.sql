-- =============================================================================
-- Migration: 021_pipeline_scale_hardening.sql
-- Purpose:   SQL-layer improvements across all 6 pipeline stages.
--
-- HOW TO APPLY: paste each block separately in the Supabase SQL editor.
-- All blocks are idempotent (safe to re-run).
-- =============================================================================


-- ============================================================
-- Block 1: build_section_baselines() with batch_limit
-- ============================================================
-- Adds batch_limit parameter (DEFAULT 500) to prevent unbounded
-- INSERT SELECT at scale (1000+ orgs = millions of page_sections rows).
-- Backward-compatible: existing supabase.rpc("build_section_baselines")
-- call passes no args so the default kicks in automatically.

CREATE OR REPLACE FUNCTION build_section_baselines(batch_limit integer DEFAULT 500)
RETURNS integer AS $func$
DECLARE
  inserted_count integer;
BEGIN
  -- Insert a baseline only when none exists for this (page, section_type) pair.
  -- Uses the OLDEST valid section as the baseline anchor (ASC created_at).
  -- LIMIT batch_limit caps the work per invocation for scale safety.
  -- Idempotent: existing baselines are never modified.
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
      WHERE sb.monitored_page_id = ps.monitored_page_id
        AND sb.section_type      = ps.section_type
    )
  ORDER BY ps.monitored_page_id, ps.section_type, ps.created_at ASC
  LIMIT batch_limit;

  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  RETURN inserted_count;
END;
$func$ LANGUAGE plpgsql;


-- ============================================================
-- Block 2: Composite index on section_baselines
-- ============================================================
-- The NOT EXISTS in build_section_baselines uses both
-- (monitored_page_id, section_type) as a compound predicate.
-- Existing index only covers monitored_page_id, requiring a heap
-- re-filter on section_type. This makes it a single index-only scan.

CREATE INDEX IF NOT EXISTS idx_section_baselines_page_type
  ON section_baselines (monitored_page_id, section_type);


-- ============================================================
-- Block 3: Tighter partial index for extract-sections
-- ============================================================
-- extract-sections now queries:
--   WHERE sections_extracted = false AND fetch_quality <> 'shell'
--   ORDER BY fetched_at ASC LIMIT 50
-- The existing idx_snapshots_pending_extraction covers only
-- sections_extracted=false. This new index covers both conditions
-- so the planner can do a direct index scan with no heap re-filter.
-- Both indexes coexist safely.

CREATE INDEX IF NOT EXISTS idx_snapshots_pending_non_shell
  ON snapshots (fetched_at ASC)
  WHERE sections_extracted = false AND fetch_quality <> 'shell';


-- ============================================================
-- Block 4: org_id index on tracked_competitors
-- ============================================================
-- radar-feed filters by org_id; plan-limit trigger counts rows per
-- org_id. Migration 018 added competitor_id and org+competitor unique
-- indexes but a standalone org_id index may not exist yet.

CREATE INDEX IF NOT EXISTS idx_tracked_competitors_org_id
  ON tracked_competitors (org_id);


-- ============================================================
-- Block 5: prune_old_snapshots()
-- ============================================================
-- raw_html is the largest column in the system. Snapshots with
-- sections already extracted should not be kept indefinitely.
--
-- Safety guards:
--   sections_extracted = true  (only processed snapshots)
--   retain_days default 90     (3 months of history)
--   NOT EXISTS guard           (skip snapshots whose page_sections
--                               are still baseline anchors or active
--                               diff endpoints)

CREATE OR REPLACE FUNCTION prune_old_snapshots(retain_days integer DEFAULT 90)
RETURNS integer AS $func$
DECLARE
  pruned_count integer;
BEGIN
  DELETE FROM snapshots s
  WHERE
    s.sections_extracted = true
    AND s.fetched_at < now() - (retain_days || ' days')::interval
    AND NOT EXISTS (
      SELECT 1 FROM page_sections ps
      WHERE ps.snapshot_id = s.id
        AND (
          EXISTS (
            SELECT 1 FROM section_baselines sb
            WHERE sb.source_section_id = ps.id
          )
          OR
          EXISTS (
            SELECT 1 FROM section_diffs sd
            WHERE sd.previous_section_id = ps.id
               OR sd.current_section_id  = ps.id
          )
        )
    );

  GET DIAGNOSTICS pruned_count = ROW_COUNT;
  RETURN pruned_count;
END;
$func$ LANGUAGE plpgsql;


-- ============================================================
-- Block 6: prune_old_section_diffs()
-- ============================================================
-- Processed diffs accumulate without bound. Two retention tiers:
--   noise diffs (is_noise=true):   180 days
--   clean processed diffs:          90 days
--
-- Safety guard: NOT EXISTS on signals preserves any diff still
-- referenced by a signal row via section_diff_id FK.

CREATE OR REPLACE FUNCTION prune_old_section_diffs(
  retain_days_clean integer DEFAULT 90,
  retain_days_noise  integer DEFAULT 180
)
RETURNS integer AS $func$
DECLARE
  pruned_count integer;
BEGIN
  DELETE FROM section_diffs sd
  WHERE
    sd.signal_detected = true
    AND (
      (sd.is_noise = true  AND sd.last_seen_at < now() - (retain_days_noise || ' days')::interval)
      OR
      (sd.is_noise = false AND sd.last_seen_at < now() - (retain_days_clean || ' days')::interval)
    )
    AND NOT EXISTS (
      SELECT 1 FROM signals sig
      WHERE sig.section_diff_id = sd.id
    );

  GET DIAGNOSTICS pruned_count = ROW_COUNT;
  RETURN pruned_count;
END;
$func$ LANGUAGE plpgsql;
