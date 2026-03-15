-- =============================================================================
-- Migration: 018_canonical_domain_and_tracking_relation.sql
-- Purpose:   Two-phase schema hardening to eliminate URL-based sync bugs:
--
--   1. competitors.domain — canonical identity (hostname only, lowercase, unique).
--      Eliminates URL-matching drift between tracked_competitors and competitors.
--
--   2. tracked_competitors.competitor_id — FK to competitors.id.
--      Establishes a relational link so cleanup paths can use ID-based joins
--      instead of URL string matching. Enables future pipeline read switch
--      from `WHERE active=true` to `WHERE EXISTS (tracked_competitors)`.
--
-- Architecture context:
--   competitors      = global pipeline registry (no org_id)
--   tracked_competitors = org-scoped tracking relation
--
--   Pipeline currently reads: competitors WHERE active=true
--   Future (Release 2): competitors JOIN tracked_competitors (relational existence)
--
-- Safe:       All steps are idempotent (ADD COLUMN IF NOT EXISTS, CREATE INDEX IF NOT EXISTS).
-- Apply via:  Supabase SQL editor (service role) or psql.
-- =============================================================================

BEGIN;

-- ── 1. Add canonical domain column to competitors ─────────────────────────────
--
-- Derived from website_url which is already stored as protocol://hostname
-- (enforced by normalizeUrl() in onboard-competitor.ts). Strip protocol to
-- get the hostname only.
--
-- DEFAULT 'unknown' allows the ADD to complete on live data; backfill
-- immediately follows, then the constraint is tightened.

ALTER TABLE competitors
  ADD COLUMN IF NOT EXISTS domain TEXT;

-- Backfill from website_url (already normalized to protocol://hostname format).
-- split_part is safer than regexp for this shape.
UPDATE competitors
SET domain = lower(split_part(split_part(website_url, '://', 2), '/', 1))
WHERE domain IS NULL
  AND website_url IS NOT NULL
  AND website_url != '';

-- Remove any remaining NULLs (rows with no website_url) with a placeholder
-- so NOT NULL constraint can be added. These rows are orphaned and should
-- be cleaned up separately.
UPDATE competitors
SET domain = 'unknown-' || id::text
WHERE domain IS NULL;

ALTER TABLE competitors
  ALTER COLUMN domain SET NOT NULL;

-- Unique index: one pipeline competitor per domain.
-- If the backfill produced duplicate domains (from URL normalization collapsing
-- protocol variants), dedup first by keeping the most recently created row.
DELETE FROM competitors a
USING competitors b
WHERE a.id > b.id
  AND a.domain = b.domain;

CREATE UNIQUE INDEX IF NOT EXISTS competitors_domain_key
  ON competitors(domain);

-- ── 2. Add competitor_id FK to tracked_competitors ───────────────────────────
--
-- Nullable — existing rows are backfilled below. New rows from updated write
-- paths will set this on insert. Rows added via discover/track before the
-- write path update may have competitor_id NULL if no matching competitor
-- exists in the pipeline registry yet.

ALTER TABLE tracked_competitors
  ADD COLUMN IF NOT EXISTS competitor_id UUID REFERENCES competitors(id);

-- Backfill competitor_id by matching normalized domain.
-- tracked_competitors.website_url may be a full URL (with path); extract
-- the hostname with the same split_part approach.
UPDATE tracked_competitors tc
SET competitor_id = c.id
FROM competitors c
WHERE tc.competitor_id IS NULL
  AND lower(split_part(split_part(tc.website_url, '://', 2), '/', 1)) = c.domain;

-- Index for efficient JOIN lookups in cleanup paths and future pipeline reads.
CREATE INDEX IF NOT EXISTS tracked_competitors_competitor_id_idx
  ON tracked_competitors(competitor_id);

-- Partial unique index: one tracking relation per (org, competitor).
-- Partial (WHERE competitor_id IS NOT NULL) to allow legacy NULL rows during
-- the transition period before all write paths are updated.
CREATE UNIQUE INDEX IF NOT EXISTS tracked_competitors_org_competitor_unique
  ON tracked_competitors(org_id, competitor_id)
  WHERE competitor_id IS NOT NULL;

COMMIT;
