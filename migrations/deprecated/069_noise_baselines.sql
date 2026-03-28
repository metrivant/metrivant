-- Migration 069: Competitor Noise Baselines
-- Tracks per-competitor noise rates (30-day rolling window) for confidence calibration

-- Create table for baseline noise statistics per competitor
CREATE TABLE IF NOT EXISTS competitor_noise_baselines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competitor_id UUID NOT NULL REFERENCES competitors(id) ON DELETE CASCADE,

  -- 30-day rolling window counts
  total_diffs INTEGER NOT NULL DEFAULT 0,
  noise_diffs INTEGER NOT NULL DEFAULT 0,

  -- Calculated rate (noise_diffs / total_diffs)
  noise_rate NUMERIC(5,4) NOT NULL DEFAULT 0.0000,

  -- Breakdown by noise reason (for ops visibility)
  reason_breakdown JSONB,

  -- Metadata
  last_updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- One baseline per competitor
  UNIQUE(competitor_id)
);

COMMENT ON TABLE competitor_noise_baselines IS 'Per-competitor noise rate baselines (30-day rolling) for confidence calibration';
COMMENT ON COLUMN competitor_noise_baselines.noise_rate IS 'Ratio of noise diffs to total diffs (0.0-1.0); used to adjust signal confidence';
COMMENT ON COLUMN competitor_noise_baselines.reason_breakdown IS 'Count by noise_reason for ops dashboard analysis';

-- Index for ops dashboard queries
CREATE INDEX IF NOT EXISTS idx_noise_baselines_rate
  ON competitor_noise_baselines(noise_rate DESC);

-- Index for daily baseline updates
CREATE INDEX IF NOT EXISTS idx_noise_baselines_updated
  ON competitor_noise_baselines(last_updated_at);
