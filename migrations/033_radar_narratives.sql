-- Migration 033: Radar narratives
--
-- Time-series narrative records explaining why competitors moved on the radar.
-- Rows are appended on trigger (never overwritten) so narrative evolution is preserved.
-- The radar feed joins to the latest row per competitor_id.
--
-- AI writes narratives; the deterministic pipeline is unchanged.

CREATE TABLE IF NOT EXISTS radar_narratives (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competitor_id       UUID NOT NULL REFERENCES competitors(id) ON DELETE CASCADE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  pressure_index      NUMERIC,
  signal_count        INTEGER,
  narrative           TEXT NOT NULL,
  evidence_signal_ids UUID[]
);

CREATE INDEX IF NOT EXISTS idx_radar_narratives_competitor_latest
  ON radar_narratives (competitor_id, created_at DESC);

COMMENT ON TABLE radar_narratives IS
  'AI-generated explanations for radar node activity. Append-only - each trigger creates a new row.';
COMMENT ON COLUMN radar_narratives.pressure_index IS
  'Pressure index at generation time. Used to compute delta for pressure trigger (increase >= 1.5).';
COMMENT ON COLUMN radar_narratives.signal_count IS
  'Number of signals passed to the model (1-5).';
COMMENT ON COLUMN radar_narratives.evidence_signal_ids IS
  'UUIDs of the signals passed to the model. Enables evidence traceability.';
