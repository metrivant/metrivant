-- =============================================================================
-- Migration: 065_interpretation_validation.sql
-- Purpose:   Add validation columns to interpretations for hallucination detection.
--
-- validate-interpretations cron checks whether strategic_implication follows
-- from the evidence (old_content, new_content). Hallucinated interpretations
-- get flagged and their parent signal's confidence is reduced.
--
-- Safe: ADD COLUMN IF NOT EXISTS. Apply via Supabase SQL editor.
-- =============================================================================

ALTER TABLE interpretations
  ADD COLUMN IF NOT EXISTS validation_status TEXT;  -- valid | weak | hallucinated | null (unchecked)

ALTER TABLE interpretations
  ADD COLUMN IF NOT EXISTS validation_reason TEXT;

ALTER TABLE interpretations
  ADD COLUMN IF NOT EXISTS validated_at TIMESTAMPTZ;
