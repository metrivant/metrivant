-- 047_last_fetched_at
--
-- Adds a denormalized last_fetched_at column to monitored_pages.
-- Stamped by fetch-snapshots on every successful HTTP fetch (content-changed
-- and content-unchanged/duplicate). Enables O(1) freshness queries without
-- joining through snapshots.
--
-- Null = page has never been successfully fetched since this migration ran.
-- Updated unconditionally on each fetch success, so it lags at most one cron
-- cycle behind the true last fetch time.

ALTER TABLE monitored_pages
  ADD COLUMN IF NOT EXISTS last_fetched_at TIMESTAMPTZ;
