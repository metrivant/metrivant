-- Migration 030: LLM enhancement fields
--
-- signals.relevance_level     — gpt-4o-mini pre-interpretation classification
-- signals.relevance_rationale — one-sentence rationale for the classification
-- strategic_movements.movement_strategic_implication — gpt-4o synthesis field
--
-- All columns are nullable so existing rows require no backfill.
-- Detection pipeline is unaffected — these columns are written post-signal.

ALTER TABLE signals
  ADD COLUMN IF NOT EXISTS relevance_level TEXT
    CHECK (relevance_level IN ('high', 'medium', 'low')),
  ADD COLUMN IF NOT EXISTS relevance_rationale TEXT;

ALTER TABLE strategic_movements
  ADD COLUMN IF NOT EXISTS movement_strategic_implication TEXT;

-- Sparse index — only populated signals benefit from filtering
CREATE INDEX IF NOT EXISTS idx_signals_relevance_level
  ON signals (relevance_level)
  WHERE relevance_level IS NOT NULL;

COMMENT ON COLUMN signals.relevance_level IS
  'gpt-4o-mini pre-classification: high | medium | low. low = skip interpretation.';
COMMENT ON COLUMN signals.relevance_rationale IS
  'One-sentence rationale from relevance classifier.';
COMMENT ON COLUMN strategic_movements.movement_strategic_implication IS
  'gpt-4o synthesized strategic implication across all signals in this movement.';
