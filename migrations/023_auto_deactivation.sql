-- =============================================================================
-- Migration: 023_auto_deactivation.sql
-- Purpose:   Permanent self-healing for pages that are persistently
--            inaccessible (bot-walled or JS-rendered). Eliminates the need
--            for manual diagnosis and deactivation of competitor pages.
--
-- How it works:
--   fetch-snapshots stores every snapshot with a quality tier:
--     'full'        = extractable content
--     'shell'       = bot wall / anti-scrape
--     'js_rendered' = SPA / client-side rendered (new tier)
--
--   A DB trigger fires after every snapshot insert. It increments a counter
--   on the monitored_page when quality != 'full', resets it when quality = 'full'.
--   When the counter reaches 10 consecutive non-full snapshots, the page is
--   automatically deactivated with a recorded reason.
--
--   The backfill block immediately deactivates pages where the last 10
--   snapshots were all non-full (catches existing bad actors without waiting
--   for 10 more crawl cycles).
--
-- HOW TO APPLY: paste each block separately in the Supabase SQL editor.
-- All blocks are idempotent (safe to re-run).
-- =============================================================================


-- ============================================================
-- Block 1: Extend fetch_quality + add columns to monitored_pages
-- ============================================================

-- Add js_rendered to the allowed fetch_quality values on snapshots.
ALTER TABLE snapshots
  DROP CONSTRAINT IF EXISTS snapshots_fetch_quality_check;

ALTER TABLE snapshots
  ADD CONSTRAINT snapshots_fetch_quality_check
  CHECK (fetch_quality IN ('full', 'shell', 'js_rendered'));

-- consecutive_non_full_snapshots: incremented by trigger on each non-full
-- snapshot insert, reset to 0 on a full snapshot. Auto-deactivation fires
-- when this reaches 10.
ALTER TABLE monitored_pages
  ADD COLUMN IF NOT EXISTS consecutive_non_full_snapshots integer NOT NULL DEFAULT 0;

-- auto_deactivated_reason: set by the trigger when the page is deactivated.
-- Values: 'shell', 'js_rendered', 'persistent_non_full_backfill'.
-- NULL when active=true or manually deactivated.
ALTER TABLE monitored_pages
  ADD COLUMN IF NOT EXISTS auto_deactivated_reason text;


-- ============================================================
-- Block 2: Trigger function + trigger
-- ============================================================
-- Fires AFTER INSERT on snapshots. Atomically increments/resets the
-- counter and auto-deactivates the page when the threshold is reached.
-- Threshold: 10 consecutive non-full snapshots.
-- Reactivation: not automatic — requires manual review or a future
-- reactivation cron. Counter resets automatically if site recovers.

CREATE OR REPLACE FUNCTION handle_snapshot_quality()
RETURNS TRIGGER AS $func$
DECLARE
  auto_deactivate_threshold CONSTANT integer := 10;
BEGIN
  IF NEW.fetch_quality = 'full' THEN
    -- Reset counter on successful full fetch.
    -- Conditional update avoids unnecessary write when already at 0.
    UPDATE monitored_pages
    SET consecutive_non_full_snapshots = 0,
        auto_deactivated_reason        = NULL
    WHERE id = NEW.monitored_page_id
      AND consecutive_non_full_snapshots > 0;
  ELSE
    -- Increment counter. Auto-deactivate if threshold reached.
    UPDATE monitored_pages
    SET
      consecutive_non_full_snapshots = consecutive_non_full_snapshots + 1,
      active = CASE
        WHEN consecutive_non_full_snapshots + 1 >= auto_deactivate_threshold
        THEN false
        ELSE active
      END,
      auto_deactivated_reason = CASE
        WHEN consecutive_non_full_snapshots + 1 >= auto_deactivate_threshold
        THEN NEW.fetch_quality
        ELSE auto_deactivated_reason
      END
    WHERE id = NEW.monitored_page_id;
  END IF;

  RETURN NEW;
END;
$func$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_snapshot_quality ON snapshots;

CREATE TRIGGER trg_snapshot_quality
AFTER INSERT ON snapshots
FOR EACH ROW
EXECUTE FUNCTION handle_snapshot_quality();


-- ============================================================
-- Block 3: Backfill — immediately deactivate known-bad pages
-- ============================================================
-- Finds pages where the last 10 snapshots are ALL non-full quality.
-- These pages have been persistently broken and would auto-deactivate
-- on the next 10 crawl cycles anyway — this makes it immediate.
-- Requires at least 10 total snapshots to avoid catching newly-onboarded
-- pages that simply haven't been crawled enough times yet.
--
-- Rewritten as CTE + ROW_NUMBER() window function to avoid the
-- Supabase SQL editor parser bug with nested correlated subqueries
-- that use LIMIT in a WHERE clause.

WITH recent_quality AS (
  SELECT
    monitored_page_id,
    COUNT(*) FILTER (WHERE fetch_quality <> 'full') AS non_full_count
  FROM (
    SELECT
      monitored_page_id,
      fetch_quality,
      ROW_NUMBER() OVER (
        PARTITION BY monitored_page_id
        ORDER BY fetched_at DESC
      ) AS rn
    FROM snapshots
  ) ranked
  WHERE rn <= 10
  GROUP BY monitored_page_id
  HAVING COUNT(*) = 10          -- page has at least 10 snapshots
),
total_counts AS (
  SELECT monitored_page_id, COUNT(*) AS total
  FROM snapshots
  GROUP BY monitored_page_id
)
UPDATE monitored_pages
SET
  consecutive_non_full_snapshots = 10,
  active                         = false,
  auto_deactivated_reason        = 'persistent_non_full_backfill'
FROM recent_quality rq
JOIN total_counts tc ON tc.monitored_page_id = rq.monitored_page_id
WHERE monitored_pages.id = rq.monitored_page_id
  AND monitored_pages.active = true
  AND tc.total >= 10
  AND rq.non_full_count = 10;


-- ============================================================
-- Block 4: Verify — inspect what was deactivated
-- ============================================================

SELECT
  c.name                                    AS competitor,
  mp.page_type,
  mp.url,
  mp.active,
  mp.consecutive_non_full_snapshots         AS consecutive_non_full,
  mp.auto_deactivated_reason                AS reason,
  (SELECT COUNT(*) FROM snapshots s
   WHERE s.monitored_page_id = mp.id)       AS total_snapshots,
  (SELECT COUNT(*) FROM snapshots s
   WHERE s.monitored_page_id = mp.id
     AND s.fetch_quality = 'full')          AS full_snapshots
FROM monitored_pages mp
JOIN competitors c ON c.id = mp.competitor_id
WHERE mp.auto_deactivated_reason IS NOT NULL
   OR mp.consecutive_non_full_snapshots > 0
ORDER BY c.name, mp.page_type;
