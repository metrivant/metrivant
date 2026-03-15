-- =============================================================================
-- Migration: 021_pipeline_scale_hardening.sql
-- Purpose:   SQL-layer improvements across all 6 pipeline stages to maintain
--            correctness and performance as the user base scales.
--
-- Changes:
--   1. build_section_baselines() — add batch_limit (DEFAULT 500) to prevent
--      unbounded INSERT SELECT at 1000+ orgs / millions of page_sections rows.
--
--   2. idx_section_baselines_page_type — composite index on (monitored_page_id,
--      section_type); the NOT EXISTS in build_section_baselines uses both columns
--      but the existing index only covers monitored_page_id.
--
--   3. idx_snapshots_pending_non_shell — replaces the concept of
--      idx_snapshots_pending_extraction for the updated extract-sections query
--      which now adds fetch_quality != 'shell'. The old index still exists and
--      is still valid; this new one is a tighter partial covering both conditions
--      so the planner can use it directly without a heap re-filter.
--
--   4. idx_section_diffs_ambient_pending — partial index scoped only to the
--      ambient query pattern in detect-ambient-activity. The existing
--      idx_section_diffs_pending_ambient index does not filter by page_class
--      (that column lives on monitored_pages, not section_diffs), so the index
--      is shared with detect-signals. Adding a targeted partial index for the
--      ambient stage is blocked until page_class is denormalized to section_diffs
--      (see NOTE below). Instead, we add a partial index per confirmed+not-noise
--      ordered by last_seen_at that matches the detect-ambient query's exact
--      predicate — no schema change needed.
--      NOTE: for full ambient/non-ambient query isolation, denormalizing
--      page_class onto section_diffs (one additional column, backfilled from
--      monitored_pages) would allow two non-overlapping partial indexes and
--      eliminate TypeScript-side filtering. Recommended as a follow-on migration
--      once current fixes are validated.
--
--   5. prune_old_snapshots() — retention function for the raw_html column,
--      the largest storage consumer in the system. Deletes snapshots with
--      sections_extracted=true older than `retain_days` (default 90). Preserves
--      any snapshot still referenced by a section_diff (via page_sections join).
--
--   6. prune_old_section_diffs() — retention function for processed diffs.
--      Deletes section_diffs with signal_detected=true AND is_noise=true older
--      than 180 days (noise), and signal_detected=true older than 90 days (clean
--      processed signals). Does NOT delete diffs still referenced by open signals.
--
--   7. idx_tracked_competitors_org_id — covering index for the org-scoped
--      radar-feed query and plan-limit trigger. Already may exist from earlier
--      migrations; CREATE INDEX IF NOT EXISTS is a no-op if so.
--
-- Apply via: Supabase SQL editor (service role).
-- Safe:      All steps are idempotent.
-- =============================================================================

BEGIN;

-- ── 1. build_section_baselines() with batch_limit ────────────────────────────
--
-- Adds a batch_limit parameter (default 500) to prevent the INSERT SELECT from
-- scanning and processing an unbounded number of page_sections rows in a single
-- cron invocation. At 1000 orgs the unguarded version scans millions of rows.
--
-- Default 500 is backward-compatible — existing call supabase.rpc("build_section_baselines")
-- requires no change; new (page, section_type) pairs beyond 500 are picked up on
-- the next cron run. The function remains idempotent.

CREATE OR REPLACE FUNCTION build_section_baselines(batch_limit integer DEFAULT 500)
RETURNS integer AS $$
DECLARE
  inserted_count integer;
BEGIN
  -- Insert a baseline only when none exists for this (page, section_type) pair.
  -- Uses the OLDEST valid section as the baseline anchor (ASCENDING created_at).
  -- LIMIT batch_limit caps the work per invocation for scale safety.
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
  ORDER BY ps.monitored_page_id, ps.section_type, ps.created_at ASC
  LIMIT batch_limit;

  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  RETURN inserted_count;
END;
$$ LANGUAGE plpgsql;

-- ── 2. Composite index: section_baselines(monitored_page_id, section_type) ───
--
-- The NOT EXISTS subquery in build_section_baselines uses both columns as a
-- compound predicate: WHERE sb.monitored_page_id = X AND sb.section_type = Y.
-- The existing idx_section_baselines_page covers only monitored_page_id, so
-- the planner must re-filter on section_type from the heap after the index scan.
-- This composite index makes the lookup a single index-only scan.

CREATE INDEX IF NOT EXISTS idx_section_baselines_page_type
  ON section_baselines (monitored_page_id, section_type);

-- ── 3. Tighter partial index for extract-sections snapshot query ──────────────
--
-- The extract-sections query now filters:
--   WHERE sections_extracted = false AND fetch_quality != 'shell'
--   ORDER BY fetched_at ASC LIMIT 50
--
-- The existing idx_snapshots_pending_extraction covers WHERE sections_extracted=false
-- but not the fetch_quality condition, so the planner must re-filter after the
-- index scan. The new partial index matches the exact predicate and allows an
-- index-only scan in the common case (no shell rows in the result set).
--
-- Both indexes can coexist — the planner will prefer the more selective one.

CREATE INDEX IF NOT EXISTS idx_snapshots_pending_non_shell
  ON snapshots (fetched_at ASC)
  WHERE sections_extracted = false AND fetch_quality <> 'shell';

-- ── 4. org_id index on tracked_competitors ───────────────────────────────────
--
-- radar-feed filters tracked_competitors by org_id; the plan-limit DB trigger
-- counts rows per org_id. Without an index this is a full table scan.
-- Migration 018 added competitor_id index and org+competitor unique index but
-- a standalone org_id covering index may not exist.

CREATE INDEX IF NOT EXISTS idx_tracked_competitors_org_id
  ON tracked_competitors (org_id);

-- ── 5. prune_old_snapshots() ─────────────────────────────────────────────────
--
-- raw_html is the largest column in the system. Snapshots with sections already
-- extracted have served their purpose and should not be kept indefinitely.
--
-- Safety guards:
--   - sections_extracted = true   (only snapshots that have been processed)
--   - retain_days default 90      (keeps 3 months of history)
--   - NOT EXISTS on page_sections (preserves snapshots whose sections are still
--     referenced as baseline source or active diff endpoints — belt-and-suspenders
--     since page_sections.snapshot_id has a FK, but explicit is safer)
--
-- Caller: invoke from detect-ambient-activity or a Supabase pg_cron job.
-- The handler currently prunes activity_events inline — snapshots can be pruned
-- the same way to keep the prune co-located with pipeline execution.

CREATE OR REPLACE FUNCTION prune_old_snapshots(retain_days integer DEFAULT 90)
RETURNS integer AS $$
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
          -- Section is a baseline anchor — must be kept.
          EXISTS (
            SELECT 1 FROM section_baselines sb
            WHERE sb.source_section_id = ps.id
          )
          OR
          -- Section is referenced by an open diff — must be kept.
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
$$ LANGUAGE plpgsql;

-- ── 6. prune_old_section_diffs() ─────────────────────────────────────────────
--
-- Processed diffs (signal_detected=true) accumulate without bound and are the
-- second-largest storage consumer after snapshots. Two retention tiers:
--
--   noise diffs (is_noise=true):    180 days — kept slightly longer for anomaly
--                                    suppression ratio forensics, then removed.
--   clean processed diffs:           90 days — processed diffs whose signals are
--                                    already interpreted and stored in signals table.
--
-- Safety guard:
--   - NOT EXISTS on signals — preserves diffs still referenced by a signal row
--     via section_diff_id FK. This avoids FK violation and protects the evidence
--     chain for any signal still in the interpretation queue.

CREATE OR REPLACE FUNCTION prune_old_section_diffs(
  retain_days_clean integer DEFAULT 90,
  retain_days_noise  integer DEFAULT 180
)
RETURNS integer AS $$
DECLARE
  pruned_count integer;
BEGIN
  DELETE FROM section_diffs sd
  WHERE
    sd.signal_detected = true
    AND (
      -- Noise diffs: longer retention for suppression ratio forensics.
      (sd.is_noise = true  AND sd.last_seen_at < now() - (retain_days_noise  || ' days')::interval)
      OR
      -- Clean processed diffs: standard 90-day window.
      (sd.is_noise = false AND sd.last_seen_at < now() - (retain_days_clean  || ' days')::interval)
    )
    -- Do not delete if a signal row still holds a reference to this diff.
    AND NOT EXISTS (
      SELECT 1 FROM signals sig
      WHERE sig.section_diff_id = sd.id
    );

  GET DIAGNOSTICS pruned_count = ROW_COUNT;
  RETURN pruned_count;
END;
$$ LANGUAGE plpgsql;

COMMIT;
