-- Migration 034: Sector intelligence
--
-- Stores cross-competitor sector analysis generated weekly by GPT-4o.
-- Scoped per org so each organization sees analysis across only its tracked competitors.
-- Evidence signal IDs are stored inside the JSONB fields (attached post-LLM, deterministically).

CREATE TABLE IF NOT EXISTS sector_intelligence (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id               UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  sector               TEXT NOT NULL,
  analysis_window_days INTEGER NOT NULL DEFAULT 30,
  competitor_count     INTEGER NOT NULL,
  signal_count         INTEGER NOT NULL,
  sector_trends        JSONB NOT NULL DEFAULT '[]'::JSONB,
  divergences          JSONB NOT NULL DEFAULT '[]'::JSONB,
  summary              TEXT
);

CREATE INDEX IF NOT EXISTS idx_sector_intelligence_org_latest
  ON sector_intelligence (org_id, created_at DESC);

COMMENT ON TABLE sector_intelligence IS
  'Weekly cross-competitor sector analysis. Append-only - each weekly run creates a new row per org.';
COMMENT ON COLUMN sector_intelligence.sector_trends IS
  'Array of {theme, direction, competitors_involved, evidence, evidence_signal_ids[]} objects. Evidence IDs attached post-LLM.';
COMMENT ON COLUMN sector_intelligence.divergences IS
  'Array of {competitor, difference, potential_significance, evidence_signal_ids[]} objects. Evidence IDs attached post-LLM.';
COMMENT ON COLUMN sector_intelligence.signal_count IS
  'Total signals passed to the model. Enables "Analysis based on N signals" display.';
