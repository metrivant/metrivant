-- =============================================================================
-- Migration: 025_baseline_advancement.sql
-- Purpose:   Versioned baseline rotation — baselines are no longer permanent.
--
-- Problem:
--   section_baselines was insert-only with a global UNIQUE(page, type).
--   After major site redesigns, the old baseline remains stale forever.
--   Every subsequent section looks like a diff, generating noise indefinitely.
--
-- Solution:
--   Add version tracking and an is_active flag. The UNIQUE constraint becomes
--   a partial index on active baselines only. A Postgres function
--   promote_section_baselines() examines 30-day observation history and
--   promotes a stable new hash to be the active baseline when:
--     - the new hash represents >= 80% of observations in the window
--     - it has been continuously present for at least 14 days
--     - fewer than 2 competing hashes exist above 20% (A/B test guard)
--     - at least 3 valid observations exist in the window
--
-- Called by:
--   /api/promote-baselines (Vercel cron, daily)
--   /api/promote-baselines?dry_run=1 (manual verification — computes but does not commit)
--
-- HOW TO APPLY: paste each block separately in the Supabase SQL editor,
-- or let the migration runner apply it automatically.
-- =============================================================================


-- ============================================================
-- Block 1: Extend section_baselines schema
-- ============================================================

-- Track baseline version history.
ALTER TABLE section_baselines
  ADD COLUMN IF NOT EXISTS version            integer      NOT NULL DEFAULT 1;

-- Flag distinguishing the current active baseline from retired historical ones.
-- Only one row per (monitored_page_id, section_type) may be active at a time.
ALTER TABLE section_baselines
  ADD COLUMN IF NOT EXISTS is_active          boolean      NOT NULL DEFAULT true;

-- Timestamp when this baseline was retired (superseded by a newer version).
ALTER TABLE section_baselines
  ADD COLUMN IF NOT EXISTS retired_at         timestamptz;

-- The source section that evidence suggested as the new stable truth.
ALTER TABLE section_baselines
  ADD COLUMN IF NOT EXISTS promoted_from_section_id uuid
    REFERENCES page_sections(id) ON DELETE SET NULL;


-- ============================================================
-- Block 2: Replace global unique constraint with partial index
-- ============================================================
-- The original UNIQUE(monitored_page_id, section_type) conflicts with
-- multiple versions of the same (page, type) pair coexisting.
-- A partial index WHERE is_active = true enforces uniqueness only
-- on active baselines — retired rows are unrestricted.

ALTER TABLE section_baselines
  DROP CONSTRAINT IF EXISTS section_baselines_monitored_page_id_section_type_key;

DROP INDEX IF EXISTS idx_section_baselines_active_unique;

CREATE UNIQUE INDEX idx_section_baselines_active_unique
  ON section_baselines (monitored_page_id, section_type)
  WHERE is_active = true;

-- Supporting indexes for the promotion function queries.
CREATE INDEX IF NOT EXISTS idx_section_baselines_page_type_active
  ON section_baselines (monitored_page_id, section_type, is_active);


-- ============================================================
-- Block 3: promote_section_baselines() function
-- ============================================================
-- Examines observation history across all (monitored_page_id, section_type)
-- pairs and promotes the active baseline when a new stable hash is dominant.
--
-- Promotion criteria (all must hold):
--   1. At least 3 valid observations in the last 30 days
--   2. One hash represents >= 80% of those observations (dominant)
--   3. That hash first appeared at least 14 days ago (recency hold)
--   4. That hash was seen within the last 14 days (still current)
--   5. Fewer than 2 competing hashes each above 20% (A/B test guard)
--   6. The dominant hash differs from the current active baseline
--
-- Returns: promoted_count, pairs_evaluated

CREATE OR REPLACE FUNCTION promote_section_baselines(dry_run boolean DEFAULT false)
RETURNS TABLE(promoted_count integer, pairs_evaluated integer)
LANGUAGE plpgsql
AS $func$
DECLARE
  stability_window  CONSTANT interval := '30 days';
  recency_hold      CONSTANT interval := '14 days';
  dominance_thresh  CONSTANT numeric  := 0.80;
  competing_thresh  CONSTANT numeric  := 0.20;
  min_observations  CONSTANT integer  := 3;

  v_promoted  integer := 0;
  v_evaluated integer := 0;
  rec         record;
BEGIN
  FOR rec IN
    WITH
    -- Recent valid observations per (page, type, hash)
    obs AS (
      SELECT
        ps.monitored_page_id,
        ps.section_type,
        ps.section_hash,
        COUNT(*)                            AS obs_count,
        MIN(ps.created_at)                  AS first_seen,
        MAX(ps.created_at)                  AS last_seen,
        SUM(COUNT(*)) OVER (
          PARTITION BY ps.monitored_page_id, ps.section_type
        )                                   AS total_obs
      FROM page_sections ps
      WHERE ps.created_at        >= now() - stability_window
        AND ps.validation_status  = 'valid'
      GROUP BY ps.monitored_page_id, ps.section_type, ps.section_hash
    ),
    -- Compute dominance ratio and flag A/B test competition
    scored AS (
      SELECT
        *,
        obs_count * 1.0 / total_obs AS dominance
      FROM obs
      WHERE total_obs >= min_observations
    ),
    -- Find pairs where a single hash clearly dominates and qualifies
    dominant AS (
      SELECT
        s.monitored_page_id,
        s.section_type,
        s.section_hash   AS candidate_hash,
        s.obs_count,
        s.dominance,
        s.first_seen,
        s.last_seen,
        -- Count competing hashes above 20% (A/B test indicator)
        (
          SELECT COUNT(*)
          FROM scored s2
          WHERE s2.monitored_page_id = s.monitored_page_id
            AND s2.section_type      = s.section_type
            AND s2.section_hash     != s.section_hash
            AND s2.dominance        >= competing_thresh
        ) AS competing_hashes
      FROM scored s
      WHERE s.dominance       >= dominance_thresh
        AND s.first_seen       <= now() - recency_hold   -- present for >= 14 days
        AND s.last_seen        >= now() - recency_hold   -- seen within last 14 days
    ),
    qualified AS (
      SELECT * FROM dominant
      WHERE competing_hashes < 2
    )
    -- Join to current active baseline — promote only when hash changed
    SELECT
      q.monitored_page_id,
      q.section_type,
      q.candidate_hash,
      q.obs_count,
      q.dominance,
      ab.id           AS old_baseline_id,
      ab.version      AS old_version,
      -- Most recent valid section with the candidate hash (source for new baseline)
      (
        SELECT ps2.id
        FROM page_sections ps2
        WHERE ps2.monitored_page_id = q.monitored_page_id
          AND ps2.section_type      = q.section_type
          AND ps2.section_hash      = q.candidate_hash
          AND ps2.validation_status = 'valid'
        ORDER BY ps2.created_at DESC
        LIMIT 1
      ) AS new_source_section_id,
      (
        SELECT ps2.section_text
        FROM page_sections ps2
        WHERE ps2.monitored_page_id = q.monitored_page_id
          AND ps2.section_type      = q.section_type
          AND ps2.section_hash      = q.candidate_hash
          AND ps2.validation_status = 'valid'
        ORDER BY ps2.created_at DESC
        LIMIT 1
      ) AS new_baseline_text
    FROM qualified q
    JOIN section_baselines ab
      ON ab.monitored_page_id = q.monitored_page_id
     AND ab.section_type      = q.section_type
     AND ab.is_active         = true
    WHERE ab.section_hash != q.candidate_hash   -- only promote when hash changed
  LOOP
    v_evaluated := v_evaluated + 1;

    -- Skip if we could not resolve a source section (page has no recent sections).
    IF rec.new_source_section_id IS NULL THEN
      CONTINUE;
    END IF;

    -- In dry-run mode, count but do not commit the promotion.
    IF NOT dry_run THEN
      -- Retire the current active baseline.
      UPDATE section_baselines
      SET is_active  = false,
          retired_at = now()
      WHERE id = rec.old_baseline_id;

      -- Insert the new active baseline as the next version.
      INSERT INTO section_baselines (
        monitored_page_id,
        section_type,
        section_hash,
        source_section_id,
        baseline_text,
        version,
        is_active,
        promoted_from_section_id
      ) VALUES (
        rec.monitored_page_id,
        rec.section_type,
        rec.candidate_hash,
        rec.new_source_section_id,
        rec.new_baseline_text,
        rec.old_version + 1,
        true,
        rec.new_source_section_id
      );
    END IF;

    v_promoted := v_promoted + 1;
  END LOOP;

  RETURN QUERY SELECT v_promoted, v_evaluated;
END;
$func$;
