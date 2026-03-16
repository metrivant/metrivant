-- Migration 029: Add resolution_status to monitored_pages
--
-- Tracks whether a monitored page URL was validated before activation.
-- All existing rows default to 'active' (no behavioral change to the pipeline).
-- The fetch-snapshots stage continues to filter by active = true.
--
-- States:
--   active    = URL validated and live
--   unresolved = category was attempted but no confident URL found (not inserted)
--   invalid   = URL found but validation failed (404, timeout) — inactive
--
-- Note: unresolved categories are not inserted into monitored_pages.
-- This column is used only for 'active' and 'invalid' states (observability).

ALTER TABLE monitored_pages
  ADD COLUMN IF NOT EXISTS resolution_status TEXT NOT NULL DEFAULT 'active'
    CHECK (resolution_status IN ('active', 'invalid'));

CREATE INDEX IF NOT EXISTS idx_monitored_pages_resolution_status
  ON monitored_pages (resolution_status)
  WHERE resolution_status != 'active';

COMMENT ON COLUMN monitored_pages.resolution_status IS
  'active = validated and live; invalid = URL failed validation (kept for auditability)';
