-- Migration 071: Weekly Briefs Validation
--
-- Adds validation columns to weekly_briefs to enable AI quality assurance
-- before email delivery.
--
-- Validation process:
-- 1. generate-brief creates brief with validation_status = 'pending'
-- 2. validate-briefs (Mon 10:15 UTC) validates brief against source artifacts
-- 3. GPT-4o-mini checks: does brief accurately reflect sector_intelligence,
--    movements, and activity artifacts? Are claims supported?
-- 4. validation_status set to 'validated' | 'weak' | 'hallucinated'
-- 5. Hallucinated briefs skip email delivery, trigger Sentry warning
--
-- Applied: 2026-03-28
-- Successfully applied to Supabase production database

BEGIN;

ALTER TABLE weekly_briefs
  ADD COLUMN IF NOT EXISTS validation_status TEXT CHECK (validation_status IN ('pending', 'validated', 'weak', 'hallucinated')),
  ADD COLUMN IF NOT EXISTS validation_reasoning TEXT,
  ADD COLUMN IF NOT EXISTS validated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS emailed_at TIMESTAMPTZ;

-- Index for loading unvalidated briefs
CREATE INDEX IF NOT EXISTS idx_weekly_briefs_validation_pending
  ON weekly_briefs(org_id, generated_at DESC)
  WHERE validation_status = 'pending';

COMMENT ON COLUMN weekly_briefs.validation_status IS
  'AI validation result: pending (awaiting validation), validated (grounded in artifacts), weak (overstated), hallucinated (unsupported claims).';

COMMENT ON COLUMN weekly_briefs.validation_reasoning IS
  'One-sentence explanation from GPT-4o-mini validation. Present when validation_status is weak or hallucinated.';

COMMENT ON COLUMN weekly_briefs.validated_at IS
  'Timestamp when validation completed. NULL if validation_status is pending.';

COMMENT ON COLUMN weekly_briefs.emailed_at IS
  'Timestamp when email was sent. NULL if not yet sent or if brief failed validation (weak/hallucinated).';

COMMIT;
