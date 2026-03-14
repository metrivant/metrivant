-- =============================================================================
-- Migration: 007_backfill_signal_coverage.sql
-- Purpose:   Three repairs for the live pipeline:
--
--   1. Add extraction rules for section types that were being generated
--      by migration 005 but not getting richer coverage where missing.
--
--   2. Reset snapshots that were marked sections_extracted=true but produced
--      ZERO page_sections (because extraction_rules were absent at the time).
--      These will be reprocessed on the next extract-sections cron run with
--      the correct rules now in place.
--
--   3. Add extraction rules for existing homepage pages that are missing
--      the headline (h2) rule — these will produce positioning_shift signals
--      when h2 content changes, which maps to market_reposition movements.
--
-- Apply via: Supabase SQL editor (service role) or psql.
-- Safe:      All inserts use ON CONFLICT DO NOTHING. The snapshot reset uses
--            a targeted UPDATE guarded by a NOT EXISTS subquery.
-- =============================================================================

BEGIN;

-- ── 1. Add headline (h2) rule for homepage pages that are missing it ──────────
-- The h1 hero rule exists from onboard-competitor.ts, but h2 subheadlines
-- are often where strategic messaging changes appear first.

INSERT INTO extraction_rules (
  monitored_page_id, section_type, selector, extract_method, active
)
SELECT mp.id, 'headline', 'h2', 'css', true
FROM monitored_pages mp
WHERE
  mp.page_type = 'homepage'
  AND mp.active = true
  AND NOT EXISTS (
    SELECT 1
    FROM extraction_rules er
    WHERE
      er.monitored_page_id = mp.id
      AND er.section_type   = 'headline'
  )
ON CONFLICT (monitored_page_id, section_type) DO NOTHING;

-- ── 2. Add release_feed rule for blog pages that used a different section_type ──
-- Some blog pages may have been added with section_type 'blog_feed' which has
-- no signal classification. Ensure 'release_feed' exists (which maps to feature_launch).

INSERT INTO extraction_rules (
  monitored_page_id, section_type, selector, extract_method, active
)
SELECT mp.id, 'release_feed', 'main', 'css', true
FROM monitored_pages mp
WHERE
  mp.page_type IN ('blog', 'changelog')
  AND mp.active = true
  AND NOT EXISTS (
    SELECT 1
    FROM extraction_rules er
    WHERE
      er.monitored_page_id = mp.id
      AND er.section_type   = 'release_feed'
  )
ON CONFLICT (monitored_page_id, section_type) DO NOTHING;

-- ── 3. Reset snapshots that were marked extracted but produced no sections ────
-- These snapshots were processed when extraction_rules were absent.
-- Resetting sections_extracted=false allows them to be reprocessed with the
-- rules now in place. Only affects snapshots with zero associated page_sections.

UPDATE snapshots s
SET
  sections_extracted     = false,
  sections_extracted_at  = null
FROM monitored_pages mp
WHERE
  s.monitored_page_id   = mp.id
  AND mp.active         = true
  AND s.sections_extracted = true
  AND NOT EXISTS (
    SELECT 1
    FROM page_sections ps
    WHERE ps.snapshot_id = s.id
  );

COMMIT;
