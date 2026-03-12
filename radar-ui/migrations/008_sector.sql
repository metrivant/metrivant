-- ── Migration 008: Sector support ────────────────────────────────────────────
--
-- Adds sector preference to organizations.
-- Sector controls display language, catalog curation, and visual framing.
-- The intelligence pipeline (signals, movements, momentum) is sector-agnostic.
--
-- Valid values: 'saas' | 'defense' | 'energy'
-- Default: 'saas' (preserves all existing org behavior unchanged)

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS sector text NOT NULL DEFAULT 'saas';

ALTER TABLE organizations
  DROP CONSTRAINT IF EXISTS organizations_sector_check;

ALTER TABLE organizations
  ADD CONSTRAINT organizations_sector_check
  CHECK (sector IN ('saas', 'defense', 'energy'));

-- Backfill: all existing orgs default to 'saas' (no-op since DEFAULT handles it)
-- UPDATE organizations SET sector = 'saas' WHERE sector IS NULL;

COMMENT ON COLUMN organizations.sector IS
  'Sector lens for display language and catalog curation. Does not affect the intelligence pipeline.';
