-- Add prompt_version column to interpretations.
-- Tracks which version of the prompt template produced each interpretation.
-- Bump PROMPT_VERSION in interpret-signals.ts when the prompt template changes
-- to invalidate stale interpretations and re-generate them on the next cycle.
ALTER TABLE interpretations ADD COLUMN IF NOT EXISTS prompt_version text;
