-- Migration 058: strategic_movements.generation_reason
--
-- Distinguishes AI-synthesized movement narratives from fallback text.
-- Without this, fallback summaries (movement_type echo or raw summary passthrough)
-- are indistinguishable from GPT-4o output in the UI and briefs.
--
-- Values: 'ai' (GPT-4o synthesis succeeded), 'fallback' (no evidence or LLM failure),
--         'deterministic' (reserved for future rule-based narratives).
-- Idempotent: safe to re-run.

ALTER TABLE strategic_movements
  ADD COLUMN IF NOT EXISTS generation_reason text
  CHECK (generation_reason IN ('ai', 'fallback', 'deterministic'));
