-- Migration 032: Movement narrative columns
--
-- Adds AI-generated narrative fields to strategic_movements.
-- These are written by the decoupled synthesize-movement-narratives cron,
-- never by the deterministic detect-movements stage.
--
-- movement_summary         — 2–3 sentence analyst narrative (replaces mechanical summary)
-- strategic_implication    — competitive significance (why it matters)
-- confidence_level         — high | medium | low (categorical, not numeric)
-- confidence_reason        — one sentence explaining the rating
-- narrative_generated_at   — timestamp of last synthesis attempt; NULL = not yet processed

ALTER TABLE strategic_movements
  ADD COLUMN IF NOT EXISTS movement_summary       TEXT,
  ADD COLUMN IF NOT EXISTS strategic_implication  TEXT,
  ADD COLUMN IF NOT EXISTS confidence_level       TEXT CHECK (confidence_level IN ('high', 'medium', 'low')),
  ADD COLUMN IF NOT EXISTS confidence_reason      TEXT,
  ADD COLUMN IF NOT EXISTS narrative_generated_at TIMESTAMPTZ;

-- Index for the synthesize handler's pending-work query
CREATE INDEX IF NOT EXISTS idx_strategic_movements_narrative_pending
  ON strategic_movements (created_at)
  WHERE movement_summary IS NULL;

COMMENT ON COLUMN strategic_movements.movement_summary IS
  'AI-generated 2–3 sentence analyst narrative. NULL = not yet synthesized. Set to deterministic fallback on LLM failure.';
COMMENT ON COLUMN strategic_movements.narrative_generated_at IS
  'Timestamp of last synthesis attempt. Used to distinguish unprocessed (NULL) from failed (non-NULL with fallback).';
