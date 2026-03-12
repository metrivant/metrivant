-- ── Migration 009: Expand sector constraint ───────────────────────────────────
--
-- Migration 008 added CHECK (sector IN ('saas', 'defense', 'energy')).
-- The onboarding flow now accepts 10 sectors. Application-level validation
-- in /api/initialize-sector is sufficient; the database CHECK is too restrictive
-- and blocks legitimate inserts.
--
-- Drop the constraint. The sector column remains NOT NULL DEFAULT 'saas'.
-- All validation is enforced in the API layer.
--
-- Run this in your Supabase SQL editor.

DO $$ BEGIN
  ALTER TABLE organizations
    DROP CONSTRAINT IF EXISTS organizations_sector_check;

  COMMENT ON COLUMN organizations.sector IS
    'Sector lens for display language and catalog curation. Validated in API layer. Does not affect the intelligence pipeline.';
EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'organizations table not found — ensure migrations 001–008 have been applied first.';
END $$;
