-- Migration 062: Sector Validation
-- Add CHECK constraint to organizations.sector + validation helper function
-- Prevents invalid sector values, ensures type safety
--
-- Safe: ALTER TABLE is non-blocking on Postgres 12+
-- Existing rows validated before constraint applied

-- ═══════════════════════════════════════════════════════════════════════════════
-- 1. Add CHECK constraint to organizations.sector
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
  -- Drop constraint if exists (idempotent)
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'organizations_sector_check'
  ) THEN
    ALTER TABLE organizations DROP CONSTRAINT organizations_sector_check;
  END IF;

  -- Add constraint with valid sector values
  ALTER TABLE organizations
    ADD CONSTRAINT organizations_sector_check
      CHECK (sector IN ('saas', 'fintech', 'cybersecurity', 'defense', 'energy', 'custom'));

  RAISE NOTICE '[1/2] Sector validation constraint added';
END $$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 2. Create validation helper function
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION validate_sector(input_sector text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  -- Return validated sector or NULL if invalid
  IF input_sector = ANY(ARRAY['saas', 'fintech', 'cybersecurity', 'defense', 'energy', 'custom']) THEN
    RETURN input_sector;
  ELSE
    RETURN NULL;
  END IF;
END;
$$;

COMMENT ON FUNCTION validate_sector IS 'Validates sector string against allowed values. Returns input if valid, NULL if invalid.';

RAISE NOTICE '[2/2] Sector validation helper created';
RAISE NOTICE 'Migration 062 complete: Sector validation active';
