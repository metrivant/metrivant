-- ── Migration 017: Clean State Reset ─────────────────────────────────────────
--
-- Addresses two critical broken flows:
--
--   A. Sector selection failing — organizations_sector_check constraint blocks
--      any sector outside ('saas','defense','energy'). Migration 009 was written
--      to drop this constraint but was not applied to production. This migration
--      re-applies the drop idempotently.
--
--   B. Track Competitor failing — 6 test competitors (Linear, Monday, Airtable,
--      Asana, ClickUp, Coda) in tracked_competitors exhaust the analyst plan
--      limit of 5. Every new tracking attempt returns 403 "Competitor limit
--      reached". Migration 015 included this cleanup but was not applied.
--
-- Run this in the Supabase SQL editor (radar-ui project).
-- Safe to run multiple times — all operations are idempotent.

-- ── A. Drop sector check constraint ───────────────────────────────────────────
--
-- organizations.sector is validated at the API layer in /api/initialize-sector
-- (VALID_SECTORS list). The DB CHECK constraint is too restrictive and breaks
-- the 7 extended sectors (cybersecurity, fintech, ai-infrastructure, devtools,
-- healthcare, consumer-tech, custom).

DO $$ BEGIN
  ALTER TABLE organizations
    DROP CONSTRAINT IF EXISTS organizations_sector_check;

  COMMENT ON COLUMN organizations.sector IS
    'Sector lens for display language and catalog curation. '
    'Validated in API layer (/api/initialize-sector VALID_SECTORS). '
    'Does not affect the intelligence pipeline.';
EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'organizations table not found — ensure migrations 001–008 have been applied first.';
END $$;

-- ── B. Remove test competitors ─────────────────────────────────────────────────
--
-- These competitors were added during development testing. Their presence
-- exhausts the analyst plan limit (5), preventing any new competitor from
-- being tracked. Remove by both name and domain for completeness.

DELETE FROM tracked_competitors
WHERE LOWER(name) IN (
  'linear',
  'monday',
  'monday.com',
  'airtable',
  'asana',
  'clickup',
  'coda'
);

-- Belt-and-suspenders: also match by domain in case name column differs
DELETE FROM tracked_competitors
WHERE website_url ILIKE ANY (ARRAY[
  '%linear.app%',
  '%monday.com%',
  '%airtable.com%',
  '%asana.com%',
  '%clickup.com%',
  '%coda.io%'
]);

-- ── Verification ──────────────────────────────────────────────────────────────
--
-- After running, confirm:
--   SELECT COUNT(*) FROM tracked_competitors;  -- should be 0 (or only legitimate entries)
--   SELECT sector FROM organizations LIMIT 5;  -- should succeed without constraint errors
